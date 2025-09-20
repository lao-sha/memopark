import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_, BooleanColumn as BooleanColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {ListingAction} from "./listingAction.model"

@Entity_()
export class Listing {
    constructor(props?: Partial<Listing>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    maker!: string

    @IntColumn_({nullable: false})
    side!: number

    @IntColumn_({nullable: false})
    base!: number

    @IntColumn_({nullable: false})
    quote!: number

    @BigIntColumn_({nullable: false})
    price!: bigint

    @BigIntColumn_({nullable: false})
    minQty!: bigint

    @BigIntColumn_({nullable: false})
    maxQty!: bigint

    @BigIntColumn_({nullable: false})
    total!: bigint

    @BigIntColumn_({nullable: false})
    remaining!: bigint

    @BooleanColumn_({nullable: false})
    partial!: boolean

    @IntColumn_({nullable: false})
    expireAt!: number

    @BooleanColumn_({nullable: false})
    active!: boolean

    @IntColumn_({nullable: false})
    createdAt!: number

    @OneToMany_(() => ListingAction, e => e.listing)
    actions!: ListingAction[]
}
