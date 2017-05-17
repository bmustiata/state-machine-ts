import { XyzState, XyzStateMachine, XyzStateChangeEvent } from '../src/sm/XyzStateMachine'
import * as chai from 'chai'

describe('test', () => {
    it('should work', () => {
        const stateMachine = new XyzStateMachine()

        let expected = 0

        stateMachine.beforeEnter(XyzState.RUNNING, (ev: XyzStateChangeEvent) => {
            console.log('before enter')
            chai.assert.equal(0, expected);
            expected += 1;
        });

        stateMachine.afterEnter(XyzState.RUNNING, (ev: XyzStateChangeEvent) => {
            console.log('after enter')
            chai.assert.equal(1, expected);
            expected += 2;
        });


        stateMachine.beforeLeave(XyzState.RUNNING, (ev: XyzStateChangeEvent) => {
            console.log('before leave')
            chai.assert.equal(3, expected);
            expected += 3;
        });

        stateMachine.afterLeave(XyzState.RUNNING, (ev: XyzStateChangeEvent) => {
            console.log('after leave leave')
            chai.assert.equal(6, expected);
            expected += 4;
        });

        stateMachine.changeState(XyzState.RUNNING);
        chai.assert.equal(3, expected);

        //stateMachine.changeState(XyzState.STOPPED);
        //chai.assert.equal(10, expected);
    })
    
    it('should not fail when listener fails', () => {
        const stateMachine = new XyzStateMachine()

        let expected = 0

        stateMachine.beforeEnter(XyzState.RUNNING, (ev: XyzStateChangeEvent) => {
            chai.assert.equal(0, expected);
            expected += 1;
        });

        stateMachine.afterEnter(XyzState.RUNNING, (ev: XyzStateChangeEvent) => {
            throw new Error("test error");
        });

        stateMachine.changeState(XyzState.RUNNING);
        chai.assert.equal(1, expected);
    })

    it('should stop transitioning on cancelled events', () => {
        const stateMachine = new XyzStateMachine()
        let expected = 0

        stateMachine.beforeEnter(XyzState.RUNNING, (ev: XyzStateChangeEvent) => {
            chai.assert.equal(0, expected);
            expected += 1;


            ev.cancel();
        });

        stateMachine.afterEnter(XyzState.RUNNING, (ev: XyzStateChangeEvent) => {
            chai.assert.isTrue(false, "Should not enter, since the event was cancelled");
        });

        chai.assert.equal(XyzState.DEFAULT, stateMachine.state);
        stateMachine.changeState(XyzState.RUNNING);

        chai.assert.equal(XyzState.DEFAULT, stateMachine.state);
        chai.assert.equal(1, expected);
    })


    it('should be decently fast', () => {
        const stateMachine = new XyzStateMachine()
        let expected = 0

        stateMachine.beforeEnter(XyzState.RUNNING, (ev: XyzStateChangeEvent) => {
            expected += 1;
        });

        stateMachine.afterEnter(XyzState.RUNNING, (ev: XyzStateChangeEvent) => {
            expected += 2;
        });


        stateMachine.beforeLeave(XyzState.RUNNING, (ev: XyzStateChangeEvent) => {
            expected += 3;
        });

        stateMachine.afterLeave(XyzState.RUNNING, (ev: XyzStateChangeEvent) => {
            expected += 4;
        });

        for (let i = 0; i < 100000; i++) {
            stateMachine.changeState(XyzState.RUNNING);
            stateMachine.changeState(XyzState.DEFAULT);
        }

        chai.assert.equal(1000000, expected);
    })

    it('should go into the initial state', () => {
        const stateMachine = new XyzStateMachine(XyzState.DEFAULT);
        let expected = 0

        stateMachine.beforeEnter(XyzState.DEFAULT, (ev) => {
            expected += 1;
        });

        stateMachine.beforeLeave(XyzState.DEFAULT, (ev) => {
            expected += 2;
        });

        chai.assert.equal(0, expected);
        stateMachine.changeState(XyzState.RUNNING);
        chai.assert.equal(3, expected);
    })

    it('should allow passing data into the events', () => {
        const stateMachine = new XyzStateMachine(XyzState.DEFAULT)
        let expected = 0

        stateMachine.beforeLeave(XyzState.DEFAULT, (ev) => {
            expected += 1 + ev.data;
        });

        chai.assert.equal(0, expected);
        stateMachine.changeState(XyzState.RUNNING, 3);
        chai.assert.equal(4, expected);
    })

    it('should allow changing the state in an after listener', () => {
        const stateMachine = new XyzStateMachine(XyzState.DEFAULT)
        let expected = 0

        stateMachine.afterEnter(XyzState.RUNNING, (ev) => {
            stateMachine.changeState(XyzState.STOPPED);
        });

        stateMachine.afterEnter(XyzState.RUNNING, (ev) => {
            expected += 1;
        });

        chai.assert.equal(XyzState.DEFAULT, stateMachine.state);
        stateMachine.changeState(XyzState.RUNNING);
        chai.assert.equal(XyzState.STOPPED, stateMachine.state);
        chai.assert.equal(1, expected);
    })

    it('should throw if changing state in a before listener', () => {
        const stateMachine = new XyzStateMachine(XyzState.DEFAULT)

        stateMachine.beforeEnter(XyzState.RUNNING, (ev) => {
            stateMachine.changeState(XyzState.STOPPED);
        });

        chai.assert.equal(XyzState.DEFAULT, stateMachine.state);
        stateMachine.changeState(XyzState.RUNNING);
    })

    it('should allow receiving data only for the right state', () => {
        const stateMachine = new XyzStateMachine(XyzState.DEFAULT);

        let data = "";

        stateMachine.onData(XyzState.DEFAULT, (name) => {
            data += `DEFAULT:${name},`
        });
        stateMachine.onData(XyzState.RUNNING, (name) => {
            data += `RUNNING:${name},`

            return XyzState.STOPPED;
        });

        stateMachine.sendData("default");
        stateMachine.sendData("default");
        stateMachine.changeState(XyzState.RUNNING);
        stateMachine.run();
        stateMachine.sendData("running");
        stateMachine.sendData("running");

        chai.assert.equal(XyzState.STOPPED, stateMachine.state);
        chai.assert.equal("DEFAULT:default,DEFAULT:default,RUNNING:running,", data.toString());
    })

    it('should not follow invalid transitions', () => {
        const stateMachine = new XyzStateMachine(XyzState.STOPPED);
        const newState = stateMachine.changeState(XyzState.RUNNING)

        chai.assert.equal(newState, XyzState.STOPPED)
    })

    it('should ensure initialization even on transitions', () => {
        const stateMachine = new XyzStateMachine();
        stateMachine.transition('run')

        chai.assert.equal(stateMachine.state, XyzState.RUNNING)
    })
    
    it('should allow resending data on a new state', () => {
        const stateMachine = new XyzStateMachine();
        let totalSum = 0

        stateMachine.onData(XyzState.DEFAULT, (data) => {
            stateMachine.sendData(XyzState.RUNNING, data + 2)
        })

        stateMachine.onData(XyzState.RUNNING, (data) => {
            stateMachine.sendData(XyzState.STOPPED, data + 3)
        })

        stateMachine.onData(XyzState.STOPPED, (data) => {
            totalSum = data
        })

        const state = stateMachine.sendData(1)

        chai.assert.equal(state, XyzState.STOPPED)
        chai.assert.equal(6, totalSum)
        chai.assert.equal(XyzState.STOPPED, stateMachine.state)
    })
})
