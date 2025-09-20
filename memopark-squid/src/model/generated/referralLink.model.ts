import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class ReferralLink {
    constructor(props?: Partial<ReferralLink>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    who!: string

    @StringColumn_({nullable: false})
    sponsor!: string

    @IntColumn_({nullable: false})
    block!: number
}
