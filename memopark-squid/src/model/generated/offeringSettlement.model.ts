import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class OfferingSettlement {
    constructor(props?: Partial<OfferingSettlement>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @IntColumn_({nullable: false})
    targetDomain!: number

    @BigIntColumn_({nullable: false})
    targetId!: bigint

    @BigIntColumn_({nullable: false})
    gross!: bigint

    @BigIntColumn_({nullable: false})
    remainder!: bigint

    @StringColumn_({nullable: true})
    shares!: string | null

    @IntColumn_({nullable: false})
    block!: number
}


