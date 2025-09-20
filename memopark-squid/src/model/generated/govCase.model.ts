import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {GovAction} from "./govAction.model"

@Entity_()
export class GovCase {
    constructor(props?: Partial<GovCase>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    pallet!: string

    @BigIntColumn_({nullable: false})
    objectId!: bigint

    @IntColumn_({nullable: false})
    openedAt!: number

    @IntColumn_({nullable: false})
    lastActionAt!: number

    @StringColumn_({nullable: false})
    evidenceCid!: string

    @OneToMany_(() => GovAction, e => e.case)
    actions!: GovAction[]
}
