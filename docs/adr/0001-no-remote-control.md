# No separate control and display pages

A Widget is operated and shown on the same page. Streams overlay it via the OBS Browser Source and use Display mode (controls hidden, optional transparent background). We deliberately do not support controlling a Widget from one browser (e.g. a phone) while it is displayed in another (e.g. OBS): OBS's embedded Chromium is a separate process with separate storage, so `BroadcastChannel`/`localStorage` sync cannot bridge them, and any real bridge needs a relay server, which breaks the "a browser is all you need" constraint.
