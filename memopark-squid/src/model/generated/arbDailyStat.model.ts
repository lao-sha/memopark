import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class ArbDailyStat {
    constructor(props?: Partial<ArbDailyStat>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @IntColumn_({nullable: false})
    day!: number

    @IntColumn_({nullable: false})
    disputes!: number

    @IntColumn_({nullable: false})
    arbitrated!: number

    @IntColumn_({nullable: false})
    release!: number

    @IntColumn_({nullable: false})
    refund!: number

    @IntColumn_({nullable: false})
    partial!: number
}
