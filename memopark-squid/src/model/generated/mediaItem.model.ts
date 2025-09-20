import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class MediaItem {
    constructor(props?: Partial<MediaItem>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BigIntColumn_({nullable: false})
    hallId!: bigint

    @StringColumn_({nullable: false})
    kind!: string

    @StringColumn_({nullable: false})
    uri!: string

    @IntColumn_({nullable: false})
    block!: number
}
