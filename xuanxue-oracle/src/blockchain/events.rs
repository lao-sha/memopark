/// InterpretationRequested事件数据
#[derive(Debug, Clone)]
pub struct InterpretationRequestedEvent {
    pub request_id: u64,
    pub divination_type: DivinationType,
    pub result_id: u64,
    pub requester: Vec<u8>,
    pub interpretation_type: InterpretationType,
    pub fee: u128,
}
