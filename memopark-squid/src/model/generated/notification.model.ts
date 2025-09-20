import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class Notification {
    constructor(props?: Partial<Notification>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    module!: string

    @StringColumn_({nullable: false})
    kind!: string

    @StringColumn_({nullable: true})
    refId!: string | undefined | null

    @StringColumn_({nullable: true})
    actor!: string | undefined | null

    @IntColumn_({nullable: false})
    block!: number

    @StringColumn_({nullable: true})
    extrinsicHash!: string | undefined | null

    @StringColumn_({nullable: true})
    meta!: string | undefined | null
}
