import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {ArbitrationAction} from "./arbitrationAction.model"

@Entity_()
export class ArbitrationCase {
    constructor(props?: Partial<ArbitrationCase>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    domain!: string

    @BigIntColumn_({nullable: false})
    objectId!: bigint

    @StringColumn_({nullable: false})
    state!: string

    @IntColumn_({nullable: false})
    openedAt!: number

    @IntColumn_({nullable: true})
    closedAt!: number | undefined | null

    @StringColumn_({nullable: true})
    decision!: string | undefined | null

    @IntColumn_({nullable: true})
    bps!: number | undefined | null

    @IntColumn_({nullable: false})
    evidenceCount!: number

    @OneToMany_(() => ArbitrationAction, e => e.case)
    actions!: ArbitrationAction[]
}
