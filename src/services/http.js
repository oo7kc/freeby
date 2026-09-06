import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

export async function requestJson(url, {method = 'GET', headers = {}, body = null, cancellable = null} = {}) {
    const session = new Soup.Session({timeout: 12});
    const message = Soup.Message.new(method, url);
    for (const [key, value] of Object.entries(headers))
        message.request_headers.append(key, value);
    if (body !== null)
        message.set_request_body_from_bytes('application/json', new GLib.Bytes(new TextEncoder().encode(JSON.stringify(body))));
    try {
        const bytes = await new Promise((resolve, reject) => session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, cancellable, (s, res) => {
            try { resolve(s.send_and_read_finish(res)); } catch (error) { reject(error); }
        }));
        let data = null;
        try { data = JSON.parse(new TextDecoder().decode(bytes.toArray())); } catch { /* Status remains available for error handling. */ }
        return {status: message.status_code, data};
    } finally {
        session.abort();
    }
}
