# Real-device test checklist

Automated tests cannot cover hardware. Run this once on the actual till (tablet or PC), in the shop, with
the real scanner and printer. Tick each line; write down anything odd.

Test with **internet switched off** from step 3 on. That is the whole point of the app.

## Setup (online)

- [ ] Open the app in Chrome. Install it ("Add to Home screen" / "Install app").
- [ ] Settings → sign in with the shop account. It says "Connected as …" and "Everything is synced".
- [ ] Settings → create the owner PIN, then a cashier with a PIN.
- [ ] Switch the language to each of Italian, English, Arabic, Bengali, Chinese. Look for empty boxes
      (missing font) or cut-off text. Arabic must flip the whole screen to right-to-left.
- [ ] While the language is **Chinese**, leave it there for a minute so the Chinese font downloads.

## Offline (switch Wi-Fi and mobile data off)

- [ ] Reload the app. It still opens, in the same language.
- [ ] The dot at the top is **red** and says Offline.
- [ ] Ring up a sale with a normal product and a **weighed** product (kg keypad). Pay cash. Receipt appears.
- [ ] Do a **credit sale** to a customer, with a deposit.
- [ ] **Hold** a sale, ring up another, then **resume** the first.
- [ ] Apply a **10% discount** and a **fixed discount**. Check the receipt total.
- [ ] Switch to the cashier PIN: only Cassa and Impostazioni appear; no costs or debts are visible.
- [ ] Receive a purchase order and record some waste.
- [ ] Reports → Chiusura giornata: totals match what you rang up. Count the drawer and compare.

## Hardware

- [ ] **USB / Bluetooth barcode scanner**: scan a product on the sales screen with nothing selected. It is added.
- [ ] **Camera scan**: tap the camera icon, point at a barcode. On Windows Chrome this uses ZXing; check it
      reads EAN-13 (supermarket) codes reliably in the shop's light, and how long it takes.
- [ ] **Receipt printing**: Print on a sale. Check width, cut-off, and that Arabic/Bengali/Chinese product
      names print as letters, not boxes. (Thermal printers installed as a normal Windows/Android printer work
      through the print dialog. Printing straight to a thermal printer without the dialog is NOT built.)
- [ ] **Z-report slip**: print it. Same checks.

## Back online

- [ ] Switch the internet on. Within about 30 seconds the red dot turns green and "N waiting" goes to zero.
- [ ] On a **second device** signed in to the same account: the sales, customers and stock arrive.
- [ ] Both devices show the same stock for a product sold on both while offline.

## Report problems with

Which step, what you saw, the device and browser, and a photo or screenshot.
