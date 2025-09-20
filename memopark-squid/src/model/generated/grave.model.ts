import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_, BooleanColumn as BooleanColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {GraveAction} from "./graveAction.model"

@Entity_()
export class Grave {
    constructor(props?: Partial<Grave>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    owner!: string

    @BigIntColumn_({nullable: false})
    parkId!: bigint

    @StringColumn_({nullable: false})
    kind!: string

    @BigIntColumn_({nullable: true})
    primaryDeceasedId!: bigint | undefined | null

    @StringColumn_({nullable: true})
    slug!: string | undefined | null

    @IntColumn_({nullable: false})
    createdAt!: number

    @BooleanColumn_({nullable: false})
    active!: boolean

    @IntColumn_({nullable: false})
    offeringsCount!: number

    @BigIntColumn_({nullable: false})
    offeringsAmount!: bigint

    @OneToMany_(() => GraveAction, e => e.grave)
    actions!: GraveAction[]
}
