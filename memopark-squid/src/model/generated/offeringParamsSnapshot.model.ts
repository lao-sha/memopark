import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"

/**
 * 供奉风控参数快照：在 OfferParamsUpdated 事件发生时记录
 * - offerWindow: 滑动窗口大小（块），为空表示“保持不变/未显式设置”
 * - offerMaxInWindow: 窗口内最大次数，空=保持
 * - minOfferAmount: 最小供奉金额（Planck），空=保持
 */
@Entity_()
export class OfferingParamsSnapshot {
    constructor(props?: Partial<OfferingParamsSnapshot>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @IntColumn_({nullable: false})
    block!: number

    @IntColumn_({nullable: true})
    offerWindow!: number | undefined | null

    @IntColumn_({nullable: true})
    offerMaxInWindow!: number | undefined | null

    @BigIntColumn_({nullable: true})
    minOfferAmount!: bigint | undefined | null
}
