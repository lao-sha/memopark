import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class OfferingPriceSnapshot {
    constructor(props?: Partial<OfferingPriceSnapshot>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @IntColumn_({nullable: false})
    kindCode!: number

    @BigIntColumn_({nullable: true})
    fixedPrice!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    unitPricePerWeek!: bigint | undefined | null

    @IntColumn_({nullable: false})
    block!: number
}
