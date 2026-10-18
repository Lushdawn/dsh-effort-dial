/**
 * Host half of Effort Dial. The feature is entirely browser-side: the composer
 * seat reads the shared per-session model directory and submits through the
 * existing `session.selectModel` remote. This row exists so the loader has a
 * package entry to discover `dsh.client` on — it registers no service.
 */
export const name = 'effort-dial'

export function apply() {}
