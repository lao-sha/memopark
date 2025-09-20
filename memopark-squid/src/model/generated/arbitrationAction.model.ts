import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, StringColumn as StringColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {ArbitrationCase} from "./arbitrationCase.model"

@Entity_()
export class ArbitrationAction {
    constructor(props?: Partial<ArbitrationAction>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => ArbitrationCase, {nullable: true})
    case!: ArbitrationCase

    @StringColumn_({nullable: false})
    kind!: string

    @IntColumn_({nullable: false})
    block!: number

    @StringColumn_({nullable: true})
    extrinsicHash!: string | undefined | null

    @StringColumn_({nullable: true})
    meta!: string | undefined | null
}
