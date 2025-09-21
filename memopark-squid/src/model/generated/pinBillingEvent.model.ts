import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class PinBillingEvent {
    constructor(props?: Partial<PinBillingEvent>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    cid!: string

    @StringColumn_({nullable: false})
    kind!: string

    @BigIntColumn_({nullable: true})
    amount!: bigint | null

    @IntColumn_({nullable: true})
    periodBlocks!: number | null

    @IntColumn_({nullable: true})
    nextChargeAt!: number | null

    @IntColumn_({nullable: false})
    block!: number
}


