// @ts-nocheck
import {TypeormDatabase} from '@subsquid/typeorm-store'
import {SubstrateBatchProcessor} from '@subsquid/substrate-processor'
import {Listing, ListingAction, Order, OrderAction, ArbitrationCase, ArbitrationAction, Notification, ArbDailyStat, Grave, GraveAction, Offering, GuestbookMessage, MediaItem, ReferralLink, OfferingPriceSnapshot} from './model'

const processor = new SubstrateBatchProcessor()
  .setDataSource({
    chain: process.env.CHAIN_WS!,
    archive: process.env.ARCHIVE_URL,
  })
  .addEvent('*')

processor.run(new TypeormDatabase(), async (ctx) => {
  for (const b of ctx.blocks) {
    for (const i of b.items) {
      const name = i.name
      const dayKey = Math.floor(b.header.height / 14400)
      const getCaseId = (domain: string, id: string) => `${domain}-${id}`
      const upsertDaily = async (mut: Partial<ArbDailyStat>) => {
        const key = dayKey.toString()
        let s = await ctx.store.findOneBy(ArbDailyStat, { id: key })
        if (!s) s = new ArbDailyStat({ id: key, day: dayKey, disputes: 0, arbitrated: 0, release: 0, refund: 0, partial: 0 })
        Object.assign(s, mut)
        await ctx.store.save(s)
      }

      if (name?.endsWith('otc_listing.ListingCreated')) {
        const ev: any = i.event
        const {id, maker, side, base, quote, price, min_qty, max_qty, total, remaining, partial, expire_at} = ev.args
        const createdAt = b.header.height
        await ctx.store.save(new Listing({
          id: id.toString(), maker: maker.toString(), side, base, quote,
          price: BigInt(price), minQty: BigInt(min_qty), maxQty: BigInt(max_qty),
          total: BigInt(total), remaining: BigInt(remaining), partial,
          expireAt: Number(expire_at), active: true, createdAt,
        }))
        await ctx.store.save(new ListingAction({ id: `${id}-Created-${createdAt}`, listing: new Listing({id: id.toString()}), kind: 'Created', block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'otc_listing', kind: 'ListingCreated', refId: id.toString(), actor: maker.toString(), block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        continue
      }

      // ===== Grave mapping =====
      if (name?.endsWith('memo_grave.HallCreated')) {
        const ev: any = i.event
        const {id, kind, owner, park_id} = ev.args
        const createdAt = b.header.height
        await ctx.store.save(new Grave({ id: id.toString(), owner: owner.toString(), parkId: BigInt(park_id), kind: kind==0?'Person':'Event', primaryDeceasedId: null, slug: null, createdAt, active: true, offeringsCount: 0, offeringsAmount: 0n }))
        await ctx.store.save(new GraveAction({ id: `${id}-GraveCreated-${createdAt}`, grave: new Grave({ id: id.toString() }), kind: 'GraveCreated', block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_grave', kind: 'HallCreated', refId: id.toString(), actor: owner.toString(), block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        continue
      }
      if (name?.endsWith('memo_grave.HallLinkedDeceased')) {
        const ev: any = i.event
        const {id, deceased_id} = ev.args
        const createdAt = b.header.height
        const g = await ctx.store.findOneBy(Grave, { id: id.toString() })
        if (g) { g.primaryDeceasedId = BigInt(deceased_id); await ctx.store.save(g) }
        await ctx.store.save(new GraveAction({ id: `${id}-GraveLinkedDeceased-${createdAt}`, grave: new Grave({ id: id.toString() }), kind: 'GraveLinkedDeceased', block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        continue
      }
      if (name?.endsWith('memo_grave.HallSetPark')) {
        const ev: any = i.event
        const {id, park_id} = ev.args
        const createdAt = b.header.height
        const g = await ctx.store.findOneBy(Grave, { id: id.toString() })
        if (g) { g.parkId = BigInt(park_id); await ctx.store.save(g) }
        await ctx.store.save(new GraveAction({ id: `${id}-GraveSetPark-${createdAt}`, grave: new Grave({ id: id.toString() }), kind: 'GraveSetPark', block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        continue
      }

      // ===== Offerings mapping（简化：amount 为空视为 0）
      if (name?.endsWith('memo_offerings.OfferingCommitted')) {
        const ev: any = i.event
        const {id, target, who, amount, block} = ev.args
        const createdAt = b.header.height
        if (Number(target[0]) === 0) { // domain 0 代表 Grave
          await ctx.store.save(new Offering({ id: id.toString(), hallId: BigInt(target[1]), who: who.toString(), amount: BigInt(amount||0), block: Number(block) }))
          const grave = await ctx.store.findOneBy(Grave, { id: target[1].toString() })
          if (grave) { grave.offeringsCount += 1; grave.offeringsAmount = BigInt(grave.offeringsAmount) + BigInt(amount||0); await ctx.store.save(grave) }
          await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_offerings', kind: 'OfferingCommitted', refId: id.toString(), actor: who.toString(), block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ target: target[1].toString() }) }))
        }
        continue
      }

      // ===== Offering price snapshots（价格时间轴）
      if (name?.endsWith('memo_offerings.OfferingPriceUpdated')) {
        const ev: any = i.event
        const {kind_code, fixed_price, unit_price_per_week} = ev.args
        const createdAt = b.header.height
        const fp = (fixed_price === null || fixed_price === undefined) ? null : BigInt(fixed_price)
        const up = (unit_price_per_week === null || unit_price_per_week === undefined) ? null : BigInt(unit_price_per_week)
        await ctx.store.save(new OfferingPriceSnapshot({ id: `${kind_code}-${createdAt}`, kindCode: Number(kind_code), fixedPrice: fp, unitPricePerWeek: up, block: createdAt }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_offerings', kind: 'OfferingPriceUpdated', refId: String(kind_code), actor: null, block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ fixed: fixed_price ?? null, unit: unit_price_per_week ?? null }) }))
        continue
      }

      // ===== Guestbook mapping（留言）
      if (name?.endsWith('grave_guestbook.MessagePosted')) {
        const ev: any = i.event
        const {arg0, arg1, arg2} = ev.args // GraveId, MessageId, AccountId（命名取决于元数据）
        const createdAt = b.header.height
        await ctx.store.save(new GuestbookMessage({ id: arg1.toString(), hallId: BigInt(arg0), who: arg2.toString(), text: '', block: createdAt }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'grave_guestbook', kind: 'MessagePosted', refId: arg1.toString(), actor: arg2.toString(), block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ graveId: arg0.toString() }) }))
        continue
      }

      // ===== Deceased media mapping（相册/媒体）
      if (name?.endsWith('deceased_media.MediaAdded')) {
        const ev: any = i.event
        const {arg0, arg1} = ev.args // MediaId, AlbumId（命名取决于元数据）
        const createdAt = b.header.height
        await ctx.store.save(new MediaItem({ id: arg0.toString(), hallId: BigInt(0), kind: 'unknown', uri: '', block: createdAt }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'deceased_media', kind: 'MediaAdded', refId: arg0.toString(), actor: null, block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ albumId: arg1.toString() }) }))
        continue
      }

      // ===== Referrals mapping =====
      if (name?.endsWith('memo_referrals.SponsorBound')) {
        const ev: any = i.event
        const {who, sponsor} = ev.args
        await ctx.store.save(new ReferralLink({ id: `${who}-${sponsor}`, who: who.toString(), sponsor: sponsor.toString(), block: b.header.height }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_referrals', kind: 'SponsorBound', refId: who.toString(), actor: sponsor.toString(), block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null }))
        continue
      }
      if (name?.endsWith('otc_listing.ListingCanceled')) {
        const {id} = (i.event as any).args
        const createdAt = b.header.height
        const l = await ctx.store.findOneBy(Listing, { id: id.toString() })
        if (l) { l.active = false; await ctx.store.save(l) }
        await ctx.store.save(new ListingAction({ id: `${id}-Canceled-${createdAt}`, listing: new Listing({id: id.toString()}), kind: 'Canceled', block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'otc_listing', kind: 'ListingCanceled', refId: id.toString(), actor: null, block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        continue
      }
      if (name?.endsWith('otc_listing.ListingExpired')) {
        const {id} = (i.event as any).args
        const createdAt = b.header.height
        const l = await ctx.store.findOneBy(Listing, { id: id.toString() })
        if (l) { l.active = false; await ctx.store.save(l) }
        await ctx.store.save(new ListingAction({ id: `${id}-Expired-${createdAt}`, listing: new Listing({id: id.toString()}), kind: 'Expired', block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'otc_listing', kind: 'ListingExpired', refId: id.toString(), actor: null, block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        continue
      }

      if (name?.endsWith('otc_order.OrderOpened')) {
        const ev: any = i.event
        const {id, listing_id, maker, taker, price, qty, amount, created_at, expire_at} = ev.args
        await ctx.store.save(new Order({
          id: id.toString(), listingId: BigInt(listing_id), maker: maker.toString(), taker: taker.toString(),
          price: BigInt(price), qty: BigInt(qty), amount: BigInt(amount), state: 'Created', createdAt: Number(created_at), expireAt: Number(expire_at)
        }))
        await ctx.store.save(new OrderAction({ id: `${id}-Opened-${b.header.height}`, order: new Order({id: id.toString()}), kind: 'Opened', block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'otc_order', kind: 'OrderOpened', refId: id.toString(), actor: taker.toString(), block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null }))
        continue
      }
      const saveOrderAction = async (id: any, kind: string, meta?: string | null) => {
        await ctx.store.save(new OrderAction({ id: `${id}-${kind}-${b.header.height}`, order: new Order({id: id.toString()}), kind, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: meta ?? null }))
      }
      if (name?.endsWith('otc_order.OrderPaidCommitted')) { const {id} = (i.event as any).args; await saveOrderAction(id, 'PaidCommitted'); await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'otc_order', kind: 'OrderPaidCommitted', refId: id.toString(), actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null })); continue }
      if (name?.endsWith('otc_order.OrderReleased')) { const {id} = (i.event as any).args; await saveOrderAction(id, 'Released'); await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'otc_order', kind: 'OrderReleased', refId: id.toString(), actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null })); continue }
      if (name?.endsWith('otc_order.OrderRefunded')) { const {id} = (i.event as any).args; await saveOrderAction(id, 'Refunded'); await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'otc_order', kind: 'OrderRefunded', refId: id.toString(), actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null })); continue }
      if (name?.endsWith('otc_order.OrderCanceled')) { const {id} = (i.event as any).args; await saveOrderAction(id, 'Canceled'); await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'otc_order', kind: 'OrderCanceled', refId: id.toString(), actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null })); continue }
      if (name?.endsWith('otc_order.OrderDisputed')) { const {id} = (i.event as any).args; await saveOrderAction(id, 'Disputed'); await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'otc_order', kind: 'OrderDisputed', refId: id.toString(), actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null })); continue }
      if (name?.endsWith('otc_order.PaymentRevealed')) { const {id} = (i.event as any).args; await saveOrderAction(id, 'PaymentRevealed'); await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'otc_order', kind: 'PaymentRevealed', refId: id.toString(), actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null })); continue }
      if (name?.endsWith('otc_order.ContactRevealed')) { const {id} = (i.event as any).args; await saveOrderAction(id, 'ContactRevealed'); await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'otc_order', kind: 'ContactRevealed', refId: id.toString(), actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null })); continue }

      // ===== Arbitration mapping =====
      if (name?.endsWith('arbitration.Disputed')) {
        const ev: any = i.event
        const {domain, id} = ev.args
        const caseId = getCaseId(Buffer.from(domain).toString('hex'), id.toString())
        const openedAt = b.header.height
        await ctx.store.save(new ArbitrationCase({
          id: caseId,
          domain: Buffer.from(domain).toString('hex'),
          objectId: BigInt(id),
          state: 'Disputed', openedAt, closedAt: null, decision: null, bps: null, evidenceCount: 0,
        }))
        await ctx.store.save(new ArbitrationAction({ id: `${caseId}-Disputed-${openedAt}` as string, case: new ArbitrationCase({ id: caseId }), kind: 'Disputed', block: openedAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        await upsertDaily({ disputes: (await ctx.store.findOneBy(ArbDailyStat, { id: dayKey.toString() }))?.disputes! + 1 || 1 })
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'arbitration', kind: 'Disputed', refId: caseId, actor: null, block: openedAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        continue
      }
      if (name?.endsWith('arbitration.Arbitrated')) {
        const ev: any = i.event
        const {domain, id, decision, bps} = ev.args
        const caseId = getCaseId(Buffer.from(domain).toString('hex'), id.toString())
        const c = await ctx.store.findOneBy(ArbitrationCase, { id: caseId })
        const closedAt = b.header.height
        if (c) {
          c.state = 'Closed'
          c.closedAt = closedAt
          c.decision = decision === 0 ? 'Release' : decision === 1 ? 'Refund' : 'Partial'
          c.bps = bps ? Number(bps) : null
          await ctx.store.save(c)
        }
        await ctx.store.save(new ArbitrationAction({ id: `${caseId}-Arbitrated-${closedAt}`, case: new ArbitrationCase({ id: caseId }), kind: 'Arbitrated', block: closedAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        // 日志指标
        const stat = await ctx.store.findOneBy(ArbDailyStat, { id: dayKey.toString() })
        const base = stat || new ArbDailyStat({ id: dayKey.toString(), day: dayKey, disputes: 0, arbitrated: 0, release: 0, refund: 0, partial: 0 })
        base.arbitrated += 1
        if (c?.decision === 'Release') base.release += 1
        else if (c?.decision === 'Refund') base.refund += 1
        else base.partial += 1
        await ctx.store.save(base)
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'arbitration', kind: 'Arbitrated', refId: caseId, actor: null, block: closedAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        continue
      }
    }
  }
})


