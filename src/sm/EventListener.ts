export enum XyzState {
    // BEGIN_STATES: STATE_NAME,
    DEFAULT,
    RUNNING,
    STOPPED,
    // END_STATES
}

export class XyzStateChangeEvent {
    _cancelled: boolean

    constructor(public previousState: XyzState,
                public targetState: XyzState,
                public data: any) {
    }

    cancel() {
        this._cancelled = true
    }
}

export const EventType = {
    BEFORE_ENTER : 'before-enter',
    BEFORE_LEAVE : 'before-leave',
    AFTER_LEAVE : 'after-leave',
    AFTER_ENTER : 'after-enter',
}

export type TransitionCallback = (event: XyzStateChangeEvent) => any;
export type DataCallback = ((data: any) => XyzState) | ((data: any) => void)

export interface CallbackRegistration {
    detach() : void
}

export class XyzStateError extends Error {
}

export class EventListener<T extends Function> {
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