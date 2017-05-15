export { EventType, XyzState, XyzStateChangeEvent, EventListener, TransitionCallback, DataCallback } from './EventListener'
import { EventType, XyzState, XyzStateError, XyzStateChangeEvent, EventListener, TransitionCallback, DataCallback } from './EventListener'

const transitionSet : { [transitionId: number]: boolean } = {}
const linkMap : { 
    [fromStateId: number] : { 
        [transitionName: string] : number 
    } 
} = {}

// BEGIN_TRANSITIONS: this.registerTransition("TRANSITION_NAME", XyzState.FROM_STATE, XyzState.TO_STATE);
registerTransition("run", XyzState.DEFAULT, XyzState.RUNNING);
registerTransition(null, XyzState.DEFAULT, XyzState.STOPPED);
registerTransition(null, XyzState.RUNNING, XyzState.DEFAULT);
registerTransition(null, XyzState.RUNNING, XyzState.STOPPED);
// END_TRANSITIONS

function registerTransition(name: string, fromState: XyzState, toState: XyzState) : void {
    transitionSet[fromState << 16 | toState] = true
    
    if (!name) {
        return
    }

    let fromMap = linkMap[fromState]
    if (!fromMap) {
        fromMap = linkMap[fromState] = {}
    }

    fromMap[name] = toState
}

export class XyzStateMachine {
    private currentState: XyzState = 0
    private currentChangeStateEvent: XyzStateChangeEvent

    private transitionListeners: { [stateId: number] : EventListener<TransitionCallback> }  = {}
    private dataListeners: { [stateId: number] : EventListener<DataCallback> } = {}

    constructor(initialState? : XyzState) {
        this.currentState = initialState || 0

        // BEGIN_STATES: this.transitionListeners[XyzState.STATE_NAME] = new EventListener<TransitionCallback>()
        this.transitionListeners[XyzState.DEFAULT] = new EventListener<TransitionCallback>()
        this.transitionListeners[XyzState.RUNNING] = new EventListener<TransitionCallback>()
        this.transitionListeners[XyzState.STOPPED] = new EventListener<TransitionCallback>()
        // END_STATES
        // BEGIN_STATES: this.dataListeners[XyzState.STATE_NAME] = new EventListener<DataCallback>()
        this.dataListeners[XyzState.DEFAULT] = new EventListener<DataCallback>()
        this.dataListeners[XyzState.RUNNING] = new EventListener<DataCallback>()
        this.dataListeners[XyzState.STOPPED] = new EventListener<DataCallback>()
        // END_STATES
    }

    get state() { 
        return this.currentState
    }

    // BEGIN_TRANSITION_SET: TRANSITION_NAME(data?: any) : XyzState { return this.transition("TRANSITION_NAME", data); }
    run(data?: any) : XyzState { return this.transition("run", data); }
    // END_TRANSITION_SET

    changeState(targetState: XyzState, data?: any) : XyzState {
        if (typeof targetState == 'undefined') {
            throw new Error('No target state specified. Can not change the state.')
        }

        const stateChangeEvent = new XyzStateChangeEvent(this.currentState, targetState, data)

        if (this.currentChangeStateEvent) {
            throw new XyzStateError(
                        `The XyzStateMachine is already in a changeState (${this.currentChangeStateEvent.previousState} -> ${this.currentChangeStateEvent.targetState}). ` +
                        `Transitioning the state machine (${this.currentState} -> ${targetState}) in \`before\` events is not supported.`);
        }

        this.currentChangeStateEvent = stateChangeEvent

        this.transitionListeners[this.currentState].fire(EventType.BEFORE_LEAVE, stateChangeEvent)
        this.transitionListeners[targetState].fire(EventType.BEFORE_ENTER, stateChangeEvent)

        if (stateChangeEvent._cancelled) {
            return this.currentState
        }

        this.currentState = targetState
        this.currentChangeStateEvent = null

        this.transitionListeners[this.currentState].fire(EventType.AFTER_LEAVE, stateChangeEvent)
        this.transitionListeners[targetState].fire(EventType.AFTER_ENTER, stateChangeEvent)

        return this.currentState
    }

    transition(linkName: string, data? : any) : XyzState {
        const sourceState = linkMap[this.currentState]

        if (!sourceState) {
            return null
        }

        const targetState = sourceState[linkName]

        if (typeof targetState == 'undefined') {
            return null
        }

        return this.changeState(targetState, data)
    }

    beforeEnter(state: XyzState, callback: TransitionCallback) {
        return this.transitionListeners[state].addListener(EventType.BEFORE_ENTER, callback)
    }

    afterEnter(state: XyzState, callback: TransitionCallback) {
        return this.transitionListeners[state].addListener(EventType.AFTER_ENTER, callback)
    }

    beforeLeave(state: XyzState, callback: TransitionCallback) {
        return this.transitionListeners[state].addListener(EventType.BEFORE_LEAVE, callback)
    }

    afterLeave(state: XyzState, callback: TransitionCallback) {
        return this.transitionListeners[state].addListener(EventType.AFTER_LEAVE, callback)
    }

    onData(state: XyzState, callback: DataCallback) {
        return this.dataListeners[state].addListener('data', callback)
    }

    sendData(data: any) : XyzState {
        return this.dataListeners[this.currentState].fire('data', data)
    }
}
