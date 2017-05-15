export enum XyzState {
    // BEGIN_STATES: STATE_NAME,
    DEFAULT,
    RUNNING,
    STOPPED,
    // END_STATES
}

export class XyzStateChangeEvent {
    _cancelled: boolean

    constructor(private _previousState: XyzState,
                private _targetState: XyzState,
                public data: any) {
    }

    get previousState() : XyzState {
        return this._previousState
    }

    get targetState() : XyzState {
        return this._targetState
    }

    cancel() {
        this._cancelled = true
    }
}

export type TransitionCallback = (event: XyzStateChangeEvent) => any;
export type DataCallback = ((data: any) => XyzState) | ((data: any) => void)

export interface CallbackRegistration {
    detach() : void
}

export class XyzStateError extends Error {
}

// BEGIN_TRANSITIONS: registerTransition("TRANSITION_NAME", XyzState.FROM_STATE, XyzState.TO_STATE);
registerTransition("run", XyzState.DEFAULT, XyzState.RUNNING);
registerTransition(null, XyzState.DEFAULT, XyzState.STOPPED);
registerTransition(null, XyzState.RUNNING, XyzState.DEFAULT);
registerTransition(null, XyzState.RUNNING, XyzState.STOPPED);
// END_TRANSITIONS

export class XyzStateMachine {
    private currentState: XyzState = null
    private initialState: XyzState

    private currentChangeStateEvent: XyzStateChangeEvent

    private transitionListeners: { [stateId: number] : EventListener<TransitionCallback> }  = {}
    private dataListeners: { [stateId: number] : EventListener<DataCallback> } = {}

    constructor(initialState? : XyzState) {
        this.initialState = initialState || 0

        // BEGIN_STATES: this.transitionListeners[XyzState.STATE_NAME] = new EventListener<TransitionCallback>()
        // FIXME: make these a `for` loop?
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
        this.ensureStateMachineInitialized()
        return this.currentState
    }

    // BEGIN_TRANSITION_SET: TRANSITION_NAME(data?: any) : XyzState { return this.transition("TRANSITION_NAME", data); }
    run(data?: any) : XyzState { return this.transition("run", data); }
    // END_TRANSITION_SET

    private ensureStateMachineInitialized() {
        if (this.currentState == null) {
            this.changeStateImpl(this.initialState, null);
        }
    }

    changeState(targetState: XyzState, data?: any) : XyzState {
        this.ensureStateMachineInitialized()
        return this.changeStateImpl(targetState, data)
    }

    changeStateImpl(targetState: XyzState, data?: any) : XyzState {
        if (typeof targetState == 'undefined') {
            throw new Error('No target state specified. Can not change the state.')
        }

        const stateChangeEvent = new XyzStateChangeEvent(this.currentState, targetState, data)

        if (this.currentChangeStateEvent) {
            throw new XyzStateError(
                        `The XyzStateMachine is already in a changeState (${this.currentChangeStateEvent.previousState} -> ${this.currentChangeStateEvent.targetState}). ` +
                        `Transitioning the state machine (${this.currentState} -> ${targetState}) in \`before\` events is not supported.`);
        }

        if (this.currentState != null && !transitionSet[this.currentState << 16 | targetState]) {
            console.error(`No transition exists between ${this.currentState} -> ${targetState}.`);
            return this.currentState;
        }

        this.currentChangeStateEvent = stateChangeEvent

        if (stateChangeEvent.previousState != null) {
            this.transitionListeners[stateChangeEvent.previousState].fire(EventType.BEFORE_LEAVE, stateChangeEvent)
        }
        this.transitionListeners[stateChangeEvent.targetState].fire(EventType.BEFORE_ENTER, stateChangeEvent)

        if (stateChangeEvent._cancelled) {
            return this.currentState
        }

        this.currentState = targetState
        this.currentChangeStateEvent = null

        if (stateChangeEvent.previousState != null) {
            this.transitionListeners[stateChangeEvent.previousState].fire(EventType.AFTER_LEAVE, stateChangeEvent)
        }
        this.transitionListeners[stateChangeEvent.targetState].fire(EventType.AFTER_ENTER, stateChangeEvent)

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
        this.ensureStateMachineInitialized()
        const targetState = this.dataListeners[this.currentState].fire('data', data)

        if (targetState != null) {
            return this.changeState(targetState, data)
        }

        return this.currentState
    }
}

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

const EventType = {
    BEFORE_ENTER : 'before-enter',
    BEFORE_LEAVE : 'before-leave',
    AFTER_LEAVE : 'after-leave',
    AFTER_ENTER : 'after-enter',
}

class EventListener<T extends Function> {
    registered : { [eventName: string] : Set<T> } = {}

    addListener(eventName: string, callback: T) : CallbackRegistration {
        let eventListeners = this.registered[eventName]
        
        if (!eventListeners) {
            eventListeners = this.registered[eventName] = new Set();
        }

        eventListeners.add(callback)

        return {
            detach() {
                eventListeners.delete(callback)
            }
        }
    }

    fire(eventName: string, ev: any) : any {
        if (!this.registered[eventName]) {
            return
        }

        let result

        this.registered[eventName].forEach(it => {
            try {
                const potentialResult = it.call(null, ev)
                if (typeof potentialResult !== 'undefined' && typeof result != 'undefined') {
                    throw new XyzStateError(`Data is already returned.`)
                }

                result = potentialResult
            } catch (e) {
                if (e instanceof XyzStateError) {
                    throw e
                }
            }
        })

        return result
    }
}

const transitionSet : { [transitionId: number]: boolean } = {}
const linkMap : { 
    [fromStateId: number] : { 
        [transitionName: string] : number 
    } 
} = {}
