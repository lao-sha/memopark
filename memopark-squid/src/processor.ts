// @ts-nocheck
import {TypeormDatabase} from '@subsquid/typeorm-store'
import {SubstrateBatchProcessor} from '@subsquid/substrate-processor'
import {Listing, ListingAction, Order, OrderAction, ArbitrationCase, ArbitrationAction, Notification, ArbDailyStat, Grave, GraveAction, Offering, GuestbookMessage, MediaItem, ReferralLink, ReferralCode, OfferingPriceSnapshot, OfferingPauseEvent, OfferingParamsSnapshot, OfferingBySacrifice, OfferingSettlement, PinBillingEvent, GovCase, GovAction, PinOverview} from './model'

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
        let rec = await ctx.store.findOneBy(Listing, { id: id.toString() })
        if (!rec) rec = new Listing({ id: id.toString(), createdAt })
        rec.maker = maker.toString(); rec.side = side; rec.base = base; rec.quote = quote
        rec.price = BigInt(price); rec.minQty = BigInt(min_qty); rec.maxQty = BigInt(max_qty)
        rec.total = BigInt(total); rec.remaining = BigInt(remaining); rec.partial = partial
        rec.expireAt = Number(expire_at); rec.active = true
        await ctx.store.save(rec)
        await ctx.store.save(new ListingAction({ id: `${id}-Created-${createdAt}`, listing: new Listing({id: id.toString()}), kind: 'Created', block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'otc_listing', kind: 'ListingCreated', refId: id.toString(), actor: maker.toString(), block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        continue
      }

      // ===== Grave mapping =====
      if (name?.endsWith('memo_grave.HallCreated')) {
        const ev: any = i.event
        const {id, kind, owner, park_id} = ev.args
        const createdAt = b.header.height
        let g = await ctx.store.findOneBy(Grave, { id: id.toString() })
        if (!g) g = new Grave({ id: id.toString(), createdAt, actions: [] as any, offeringsCount: 0, offeringsAmount: 0n } as any)
        g.owner = owner.toString(); g.parkId = BigInt(park_id); g.kind = kind==0?'Person':'Event'; g.active = true
        await ctx.store.save(g)
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
          let rec = await ctx.store.findOneBy(Offering, { id: id.toString() })
          if (!rec) rec = new Offering({ id: id.toString() })
          rec.hallId = BigInt(target[1]); rec.who = who.toString(); rec.amount = BigInt(amount||0); rec.block = Number(block)
          await ctx.store.save(rec)
          const grave = await ctx.store.findOneBy(Grave, { id: target[1].toString() })
          if (grave) { grave.offeringsCount += 1; grave.offeringsAmount = BigInt(grave.offeringsAmount) + BigInt(amount||0); await ctx.store.save(grave) }
          await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_offerings', kind: 'OfferingCommitted', refId: id.toString(), actor: who.toString(), block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ target: target[1].toString() }) }))
        }
        continue
      }
      // 供奉分账结算：OfferingRouted（按 id 合并视图）
      if (name?.endsWith('memo_offerings.OfferingRouted')) {
        const ev: any = i.event
        const {id, target, gross, shares, remainder} = ev.args
        const createdAt = b.header.height
        let rec = await ctx.store.findOneBy(OfferingSettlement, { id: id.toString() })
        if (!rec) rec = new OfferingSettlement({ id: id.toString() })
        rec.targetDomain = Number(target[0]); rec.targetId = BigInt(target[1])
        rec.gross = BigInt(gross||0); rec.remainder = BigInt(remainder||0)
        let parsedShares: {account: string, amount: string}[] = []
        try { const arr = shares as any[]; parsedShares = (arr || []).map((x: any) => ({ account: x[0].toString(), amount: (x[1]||0).toString() })) } catch {}
        rec.shares = JSON.stringify(parsedShares); rec.block = createdAt
        await ctx.store.save(rec)
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_offerings', kind: 'OfferingRouted', refId: id.toString(), actor: null, block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ target: target[1].toString() }) }))
        continue
      }

      // ===== memo_ipfs 计费生命周期事件（幂等 upsert）=====
      if (name?.endsWith('memo_ipfs.PinCharged')) {
        const ev: any = i.event
        const {arg0, arg1, arg2, arg3} = ev.args // cid_hash, amount, period_blocks, next_charge_at
        const cid = Buffer.from(arg0).toString('hex')
        const id = `${cid}-${b.header.height}-${i.idx}`
        let e = await ctx.store.findOneBy(PinBillingEvent, { id })
        if (!e) e = new PinBillingEvent({ id })
        e.cid = cid; e.kind = 'PinCharged'; e.amount = BigInt(arg1||0); e.periodBlocks = Number(arg2||0); e.nextChargeAt = Number(arg3||0); e.block = b.header.height
        await ctx.store.save(e)
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_ipfs', kind: 'PinCharged', refId: cid, actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null }))
        let ov = await ctx.store.findOneBy(PinOverview, { id: cid })
        if (!ov) ov = new PinOverview({ id: cid, firstSeen: b.header.height, owner: null, replicas: null, sizeBytes: null, totalCharged: 0n, lastNextChargeAt: null, lastState: 'Active' })
        ov.totalCharged = BigInt(ov.totalCharged) + BigInt(arg1||0)
        ov.lastNextChargeAt = Number(arg3||0)
        ov.lastState = 'Active'
        await ctx.store.save(ov)
        continue
      }
      if (name?.endsWith('memo_ipfs.PinGrace')) {
        const ev: any = i.event
        const {arg0} = ev.args // cid_hash
        const cid = Buffer.from(arg0).toString('hex')
        const id = `${cid}-${b.header.height}-${i.idx}`
        let e = await ctx.store.findOneBy(PinBillingEvent, { id })
        if (!e) e = new PinBillingEvent({ id })
        e.cid = cid; e.kind = 'PinGrace'; e.amount = null; e.periodBlocks = null; e.nextChargeAt = null; e.block = b.header.height
        await ctx.store.save(e)
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_ipfs', kind: 'PinGrace', refId: cid, actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null }))
        let ov = await ctx.store.findOneBy(PinOverview, { id: cid })
        if (!ov) ov = new PinOverview({ id: cid, firstSeen: b.header.height, owner: null, replicas: null, sizeBytes: null, totalCharged: 0n, lastNextChargeAt: null, lastState: 'Grace' })
        ov.lastState = 'Grace'
        await ctx.store.save(ov)
        continue
      }
      if (name?.endsWith('memo_ipfs.PinExpired')) {
        const ev: any = i.event
        const {arg0} = ev.args // cid_hash
        const cid = Buffer.from(arg0).toString('hex')
        const id = `${cid}-${b.header.height}-${i.idx}`
        let e = await ctx.store.findOneBy(PinBillingEvent, { id })
        if (!e) e = new PinBillingEvent({ id })
        e.cid = cid; e.kind = 'PinExpired'; e.amount = null; e.periodBlocks = null; e.nextChargeAt = null; e.block = b.header.height
        await ctx.store.save(e)
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_ipfs', kind: 'PinExpired', refId: cid, actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null }))
        let ov = await ctx.store.findOneBy(PinOverview, { id: cid })
        if (!ov) ov = new PinOverview({ id: cid, firstSeen: b.header.height, owner: null, replicas: null, sizeBytes: null, totalCharged: 0n, lastNextChargeAt: null, lastState: 'Expired' })
        ov.lastState = 'Expired'
        await ctx.store.save(ov)
        continue
      }

      // PinRequested → 初始化合并视图（若来自 memo_ipfs）
      if (name?.endsWith('memo_ipfs.PinRequested')) {
        const ev: any = i.event
        const {arg0, arg1, arg2, arg3, arg4} = ev.args // cid_hash, owner, replicas, size_bytes, price
        const cid = Buffer.from(arg0).toString('hex')
        let ov = await ctx.store.findOneBy(PinOverview, { id: cid })
        if (!ov) ov = new PinOverview({ id: cid, firstSeen: b.header.height, owner: String(arg1), replicas: Number(arg2), sizeBytes: BigInt(arg3), totalCharged: 0n, lastNextChargeAt: null, lastState: 'Requested' })
        await ctx.store.save(ov)
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_ipfs', kind: 'PinRequested', refId: cid, actor: String(arg1), block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ replicas: Number(arg2), sizeBytes: String(arg3), price: String(arg4) }) }))
        continue
      }

      // 目录下单事件
      if (name?.endsWith('memo_offerings.OfferingCommittedBySacrifice')) {
        const ev: any = i.event
        const {id, target, sacrifice_id, who, amount, duration_weeks, block} = ev.args
        const createdAt = b.header.height
        await ctx.store.save(new OfferingBySacrifice({
          id: id.toString(),
          targetDomain: Number(target[0]),
          targetId: BigInt(target[1]),
          sacrificeId: BigInt(sacrifice_id),
          who: who.toString(),
          amount: BigInt(amount||0),
          durationWeeks: duration_weeks == null ? null : Number(duration_weeks),
          block: Number(block),
        }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_offerings', kind: 'OfferingCommittedBySacrifice', refId: id.toString(), actor: who.toString(), block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ sacrificeId: sacrifice_id.toString() }) }))
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
        // 将价格更新纳入治理时间线（scope=2，key=kind_code）
        const scope = 2, key = BigInt(kind_code)
        const objectId = ((BigInt(scope) << 56n) + key).toString()
        const caseId = await ensureGovCase('memo_offerings', objectId, createdAt, null)
        await ctx.store.save(new GovAction({ id: `${caseId}-PriceUpdated-${createdAt}-${i.idx}`, case: new GovCase({ id: caseId }), kind: 'PriceUpdated', block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ kind_code: String(kind_code), fixed: fixed_price ?? null, unit: unit_price_per_week ?? null }) }))
        continue
      }

      // 供奉风控参数更新（仅记录时间点，作为审计时间线的一部分）
      if (name?.endsWith('memo_offerings.OfferParamsUpdated')) {
        const createdAt = b.header.height
        // 从同一 extrinsic 输入参数解析（gov_set_offer_params 或 set_offer_params）
        let offerWindow: number | null = null
        let offerMaxInWindow: number | null = null
        let minOfferAmount: bigint | null = null
        try {
          const call: any = i.extrinsic?.call
          if (call) {
            const section = call.section?.toString?.() || ''
            const method = call.method?.toString?.() || ''
            const args: any[] = call.args || []
            if (/memo[_-]?offerings/i.test(section) && /setOfferParams|govSetOfferParams/.test(method)) {
              // 形参顺序：[offer_window, offer_max_in_window, min_offer_amount, (evidence?)]
              offerWindow = args?.[0] == null ? null : Number(args[0])
              offerMaxInWindow = args?.[1] == null ? null : Number(args[1])
              minOfferAmount = args?.[2] == null ? null : BigInt(args[2])
            }
          }
        } catch {}
        await ctx.store.save(new OfferingParamsSnapshot({ id: `${createdAt}-${i.idx}`, block: createdAt, offerWindow: offerWindow == null ? null : Number(offerWindow), offerMaxInWindow: offerMaxInWindow == null ? null : Number(offerMaxInWindow), minOfferAmount: minOfferAmount == null ? null : BigInt(minOfferAmount) }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_offerings', kind: 'OfferParamsUpdated', refId: null, actor: null, block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ offerWindow, offerMaxInWindow, minOfferAmount: minOfferAmount == null ? null : minOfferAmount.toString() }) }))
        // 将参数更新纳入治理时间线（scope=1，key=0）
        const scope = 1, key = 0n
        const objectId = ((BigInt(scope) << 56n) + key).toString()
        const caseId = await ensureGovCase('memo_offerings', objectId, createdAt, null)
        await ctx.store.save(new GovAction({ id: `${caseId}-ParamsUpdated-${createdAt}-${i.idx}`, case: new GovCase({ id: caseId }), kind: 'ParamsUpdated', block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: null }))
        continue
      }

      // 供奉域：治理证据
      if (name?.endsWith('memo_offerings.GovEvidenceNoted')) {
        const ev: any = i.event
        const {arg0, arg1, arg2} = ev.args // scope(u8), key(u64), cid(bytes)
        const scope = Number(arg0)
        const key = BigInt(arg1)
        const cid = typeof arg2 === 'string' ? arg2 : (Buffer.from(arg2?.toString?.() || '').toString())
        // 组合 objectId：高 8 比特为 scope，低 56 比特为 key（足够覆盖 u64 的低位场景）
        const objectId = ((BigInt(scope) << 56n) + key).toString()
        const caseId = await ensureGovCase('memo_offerings', objectId, b.header.height, cid)
        await ctx.store.save(new GovAction({ id: `${caseId}-Evidence-${b.header.height}-${i.idx}`, case: new GovCase({ id: caseId }), kind: 'GovEvidenceNoted', block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ scope, key: key.toString(), cid }) }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_offerings', kind: 'GovEvidenceNoted', refId: `${scope}-${key.toString()}`, actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ cid }) }))
        continue
      }

      // 暂停事件
      if (name?.endsWith('memo_offerings.PausedGlobalSet')) {
        const ev: any = i.event
        const {paused} = ev.args
        await ctx.store.save(new OfferingPauseEvent({ id: `G-${b.header.height}-${i.idx}`, scope: 'Global', domain: null, paused: Boolean(paused), block: b.header.height }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_offerings', kind: 'PausedGlobalSet', refId: null, actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ paused: Boolean(paused) }) }))
        // 纳入治理时间线（scope=3，key=0）
        const createdAt = b.header.height
        const scope = 3, key = 0n
        const objectId = ((BigInt(scope) << 56n) + key).toString()
        const caseId = await ensureGovCase('memo_offerings', objectId, createdAt, null)
        await ctx.store.save(new GovAction({ id: `${caseId}-PausedGlobalSet-${createdAt}-${i.idx}`, case: new GovCase({ id: caseId }), kind: 'PausedGlobalSet', block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ paused: Boolean(paused) }) }))
        continue
      }
      if (name?.endsWith('memo_offerings.PausedDomainSet')) {
        const ev: any = i.event
        const {domain, paused} = ev.args
        await ctx.store.save(new OfferingPauseEvent({ id: `D-${domain}-${b.header.height}-${i.idx}`, scope: 'Domain', domain: Number(domain), paused: Boolean(paused), block: b.header.height }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_offerings', kind: 'PausedDomainSet', refId: String(domain), actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ domain: Number(domain), paused: Boolean(paused) }) }))
        // 纳入治理时间线（scope=4，key=domain）
        const createdAt = b.header.height
        const scope = 4, key = BigInt(domain)
        const objectId = ((BigInt(scope) << 56n) + key).toString()
        const caseId = await ensureGovCase('memo_offerings', objectId, createdAt, null)
        await ctx.store.save(new GovAction({ id: `${caseId}-PausedDomainSet-${createdAt}-${i.idx}`, case: new GovCase({ id: caseId }), kind: 'PausedDomainSet', block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ domain: Number(domain), paused: Boolean(paused) }) }))
        continue
      }

      // 已移除模块：grave_guestbook 相关事件不再处理
      if (name?.includes('grave_guestbook')) {
        continue
      }

      // ===== Deceased media mapping（相册/媒体）
      if (name?.endsWith('deceased_media.MediaAdded') || name?.endsWith('deceased_media.MediaAddedToVideoCollection')) {
        const ev: any = i.event
        const {arg0, arg1} = ev.args // MediaId, 容器ID（命名取决于元数据）
        const createdAt = b.header.height
        let rec = await ctx.store.findOneBy(MediaItem, { id: arg0.toString() })
        if (!rec) rec = new MediaItem({ id: arg0.toString(), hallId: BigInt(0), kind: 'unknown', uri: '', block: createdAt })
        rec.hallId = BigInt(0); rec.kind = name.endsWith('MediaAddedToVideoCollection')?'VideoCollection':'unknown'; rec.uri = ''; rec.block = createdAt
        await ctx.store.save(rec)
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'deceased_media', kind: name.endsWith('MediaAddedToVideoCollection')?'MediaAddedToVideoCollection':'MediaAdded', refId: arg0.toString(), actor: null, block: createdAt, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ containerId: arg1?.toString?.() }) }))
        continue
      }

      // 投诉裁决类事件（媒体域）
      if (name?.startsWith('deceased_media.')) {
        const evName = name.split('.')[1]
        if (['ComplaintResolved','ComplaintPayoutWinner','ComplaintPayoutArbitration','ComplaintPayoutLoserRefund','AlbumPrimaryChanged','PrimaryImageChanged','VideoCollectionPrimaryChanged','GovMediaHidden','GovMediaReplaced','MediaRemoved','AlbumCreated','VideoCollectionCreated'].includes(evName)) {
          await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'deceased_media', kind: evName, refId: null, actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null }))
          continue
        }
      }

      // 文本域（deceased_text）关键事件
      if (name?.startsWith('deceased_text.')) {
        const evName = name.split('.')[1]
        if (['ArticleSet','MessageAdded','TextEdited','TextRemoved','LifeCreated','LifeUpdated','LifeUpdatedByOthers','EulogyCreated','EulogyUpdated','EulogyRemoved','ComplaintResolved','ComplaintPayoutWinner','ComplaintPayoutArbitration','ComplaintPayoutLoserRefund'].includes(evName)) {
          await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'deceased_text', kind: evName, refId: null, actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null }))
          continue
        }
      }

      // ===== Referrals mapping =====
      if (name?.endsWith('memo_referrals.SponsorBound')) {
        const ev: any = i.event
        const {who, sponsor} = ev.args
        await ctx.store.save(new ReferralLink({ id: `${who}-${sponsor}`, who: who.toString(), sponsor: sponsor.toString(), block: b.header.height }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_referrals', kind: 'SponsorBound', refId: who.toString(), actor: sponsor.toString(), block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null }))
        continue
      }
      // 推荐码分配事件（已统一在 memo_referrals）
      if (name?.endsWith('memo_referrals.ReferralCodeAssigned')) {
        const ev: any = i.event
        const {who, code} = ev.args
        const codeStr = typeof code === 'string' ? code : Buffer.from(code?.toString?.() || '').toString()
        await ctx.store.save(new ReferralCode({ id: codeStr, owner: who.toString(), block: b.header.height }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'memo_referrals', kind: 'ReferralCodeAssigned', refId: codeStr, actor: who.toString(), block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null }))
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

      // ===== Governance: deceased 事件 → GovCase/GovAction
      const ensureGovCase = async (pallet: string, objectId: string, block: number, evidenceCid?: string | null) => {
        const caseId = `${pallet}-${objectId}`
        let c = await ctx.store.findOneBy(GovCase, { id: caseId })
        if (!c) {
          c = new GovCase({ id: caseId, pallet, objectId: BigInt(objectId), openedAt: block, lastActionAt: block, evidenceCid: evidenceCid || '' })
        }
        if (evidenceCid) c.evidenceCid = evidenceCid
        c.lastActionAt = block
        await ctx.store.save(c)
        return caseId
      }
      // GovEvidenceNoted(id, evidence_cid)
      if (name?.endsWith('deceased.GovEvidenceNoted')) {
        const ev: any = i.event
        const {arg0, arg1} = ev.args // id, cid (bytes)
        const id = String(arg0)
        const cid = typeof arg1 === 'string' ? arg1 : (Buffer.from(arg1?.toString?.() || '').toString())
        const caseId = await ensureGovCase('deceased', id, b.header.height, cid)
        await ctx.store.save(new GovAction({ id: `${caseId}-Evidence-${b.header.height}-${i.idx}`, case: new GovCase({ id: caseId }), kind: 'GovEvidenceNoted', block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ cid }) }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'deceased', kind: 'GovEvidenceNoted', refId: id, actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ cid }) }))
        continue
      }
      if (name?.endsWith('deceased.DeceasedUpdated')) {
        const {arg0} = (i.event as any).args // id
        const id = String(arg0)
        const caseId = await ensureGovCase('deceased', id, b.header.height, null)
        await ctx.store.save(new GovAction({ id: `${caseId}-Updated-${b.header.height}-${i.idx}`, case: new GovCase({ id: caseId }), kind: 'DeceasedUpdated', block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'deceased', kind: 'DeceasedUpdated', refId: id, actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: null }))
        continue
      }
      if (name?.endsWith('deceased.DeceasedTransferred')) {
        const {arg0, arg1, arg2} = (i.event as any).args // id, from, to
        const id = String(arg0)
        const caseId = await ensureGovCase('deceased', id, b.header.height, null)
        await ctx.store.save(new GovAction({ id: `${caseId}-Transferred-${b.header.height}-${i.idx}`, case: new GovCase({ id: caseId }), kind: 'DeceasedTransferred', block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ from: String(arg1), to: String(arg2) }) }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'deceased', kind: 'DeceasedTransferred', refId: id, actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ from: String(arg1), to: String(arg2) }) }))
        continue
      }
      if (name?.endsWith('deceased.VisibilityChanged')) {
        const {arg0, arg1} = (i.event as any).args // id, public
        const id = String(arg0)
        const caseId = await ensureGovCase('deceased', id, b.header.height, null)
        await ctx.store.save(new GovAction({ id: `${caseId}-Visibility-${b.header.height}-${i.idx}`, case: new GovCase({ id: caseId }), kind: 'VisibilityChanged', block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ public: Boolean(arg1) }) }))
        await ctx.store.save(new Notification({ id: `N-${b.header.height}-${i.idx}`, module: 'deceased', kind: 'VisibilityChanged', refId: id, actor: null, block: b.header.height, extrinsicHash: i.extrinsic?.hash, meta: JSON.stringify({ public: Boolean(arg1) }) }))
        continue
      }

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


