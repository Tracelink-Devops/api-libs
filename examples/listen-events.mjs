// Listen to Tracelink events over STOMP with an API token - no packages needed.
//
// Node.js 22 or newer (built-in WebSocket); the same code runs in a browser.
//
//   TRACELINK_TOKEN=<your access token> node examples/listen-events.mjs [destination ...]
//
// Destinations default to /topic/order.update. Examples:
//
//   node examples/listen-events.mjs /topic/order.create /topic/order.update
//   node examples/listen-events.mjs /topic/purchase.update /topic/crm.update
//
// TRACELINK_EVENTS_URL overrides the address (default wss://tracelink.app/wss) - use your company's own host
// if it has one. See https://tracelink.dk/api-doc/#11 for the topics, the messages and what a token may do.

const token = process.env.TRACELINK_TOKEN;
const url = process.env.TRACELINK_EVENTS_URL || 'wss://tracelink.app/wss';
const destinations = process.argv.slice(2).length ? process.argv.slice(2) : ['/topic/order.update'];

if (!token) {
	console.error('Set TRACELINK_TOKEN to your access token');
	process.exit(1);
}

/**
 * Build one STOMP frame. A frame ends with a NUL byte.
 * @param {string} command - CONNECT, SUBSCRIBE, ...
 * @param {object} headers - The frame's headers
 * @returns {string} The frame
 */
function frame(command, headers = {}) {
	return command + '\n' + Object.entries(headers).map(([key, value]) => key + ':' + value).join('\n') + '\n\n\0';
}

/**
 * Split what the broker sent into frames: { command, headers, body }. Several frames can come in one message,
 * and a lone newline is a heart-beat.
 * @param {string} data - The WebSocket message
 * @returns {Array<{command: string, headers: object, body: string}>} The frames
 */
function parseFrames(data) {
	return String(data).split('\0').map((raw) => raw.replace(/^\n+/, '')).filter(Boolean).map((text) => {
		const blank = text.indexOf('\n\n');
		const head = blank >= 0 ? text.slice(0, blank) : text;
		const [command, ...lines] = head.split('\n');
		const headers = {};
		for (const line of lines) {
			const colon = line.indexOf(':');
			headers[line.slice(0, colon)] = line.slice(colon + 1);
		}
		return { command, headers, body: blank >= 0 ? text.slice(blank + 2) : '' };
	});
}

/**
 * What to do with an event - here it is printed. The body is the row as JSON; an update has `changed` too:
 * { field: { from, to } }.
 * @param {string} destination - Where it came from, e.g. /topic/order.update
 * @param {object} headers - company, dept, the row's keys, event-key, ...
 * @param {object} row - The row
 */
function onEvent(destination, headers, row) {
	const changed = row.changed ? Object.keys(row.changed).join(', ') : '';
	console.log(new Date().toISOString(), destination, 'company', headers.company, changed ? 'changed: ' + changed : '');
}

let retry_ms = 1000;

/** Connect, subscribe, and connect again when the connection is lost - a topic keeps nothing while you are away */
function connect() {
	const ws = new WebSocket(url, ['v11.stomp']);

	ws.onopen = () => {
		ws.send(frame('CONNECT', { 'accept-version': '1.1', host: new URL(url).hostname, 'access-token': token }));
	};

	ws.onmessage = (event) => {
		for (const { command, headers, body } of parseFrames(event.data)) {
			if (command === 'CONNECTED') {
				retry_ms = 1000;
				destinations.forEach((destination, i) => ws.send(frame('SUBSCRIBE', { id: 'sub-' + i, destination })));
				console.log('Connected - listening to', destinations.join(', '));
				// Missed events while you were away? Read the changes from the API here.
			} else if (command === 'MESSAGE') {
				try {
					onEvent(headers.destination, headers, JSON.parse(body));
				} catch (e) {
					console.error('Could not handle a message:', e.message);
				}
			} else if (command === 'ERROR') {
				console.error('ERROR:', headers.message, body);
				if (headers.message === 'Authentication failed') {
					// a token that does not hold will not hold the next time either
					process.exit(1);
				}
			}
		}
	};

	ws.onclose = () => {
		console.log('Connection closed - connecting again in', retry_ms / 1000, 's');
		setTimeout(connect, retry_ms);
		retry_ms = Math.min(retry_ms * 2, 60000);
	};

	ws.onerror = () => {
		// onclose follows and connects again
	};
}

connect();
