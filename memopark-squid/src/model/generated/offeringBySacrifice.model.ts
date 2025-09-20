import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class OfferingBySacrifice {
    constructor(props?: Partial<OfferingBySacrifice>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @IntColumn_({nullable: false})
    targetDomain!: number

    @BigIntColumn_({nullable: false})
    targetId!: bigint

    @BigIntColumn_({nullable: false})
    sacrificeId!: bigint

    @StringColumn_({nullable: false})
    who!: string

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @IntColumn_({nullable: true})
    durationWeeks!: number | undefined | null

    @IntColumn_({nullable: false})
    block!: number
}
