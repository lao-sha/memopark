import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class PinOverview {
    constructor(props?: Partial<PinOverview>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @IntColumn_({nullable: false})
    firstSeen!: number

    @StringColumn_({nullable: true})
    owner!: string | null

    @IntColumn_({nullable: true})
    replicas!: number | null

    @BigIntColumn_({nullable: true})
    sizeBytes!: bigint | null

    @BigIntColumn_({nullable: false})
    totalCharged!: bigint

    @IntColumn_({nullable: true})
    lastNextChargeAt!: number | null

    @StringColumn_({nullable: true})
    lastState!: string | null
}


