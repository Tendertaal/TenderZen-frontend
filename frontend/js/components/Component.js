/**
 * Base Component Class
 * All components extend from this class
 */

export class Component {
    constructor(props = {}) {
        this.props = props;
        this.element = null;
        this.eventHandlers = new Map();
    }

    /**
     * Render the component
     * Override this in child classes
     */
    render() {
        throw new Error('Component must implement render() method');
    }

    /**
     * Event emitter
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    /**
     * Emit event
     */
    emit(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
    }

    /**
     * Cleanup (override if needed)
     */
    cleanup() {
        this.eventHandlers.clear();
    }
}

export default Component;
