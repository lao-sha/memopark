import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {OrderAction} from "./orderAction.model"

@Entity_()
export class Order {
    constructor(props?: Partial<Order>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BigIntColumn_({nullable: false})
    listingId!: bigint

    @StringColumn_({nullable: false})
    maker!: string

    @StringColumn_({nullable: false})
    taker!: string

    @BigIntColumn_({nullable: false})
    price!: bigint

    @BigIntColumn_({nullable: false})
    qty!: bigint

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @StringColumn_({nullable: false})
    state!: string

    @IntColumn_({nullable: false})
    createdAt!: number

    @IntColumn_({nullable: false})
    expireAt!: number

    @OneToMany_(() => OrderAction, e => e.order)
    actions!: OrderAction[]
}
