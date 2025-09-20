import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_, BooleanColumn as BooleanColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class OfferingPauseEvent {
    constructor(props?: Partial<OfferingPauseEvent>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    scope!: string

    @IntColumn_({nullable: true})
    domain!: number | undefined | null

    @BooleanColumn_({nullable: false})
    paused!: boolean

    @IntColumn_({nullable: false})
    block!: number
}
