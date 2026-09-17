# ECOM ICS Pairing Tool v13

v13 adjusts the metadata row before download to match the supplied reference layout.

Metadata is arranged as merged blocks:
- A3:B3 = From: 000
- C3:D3 = To: 105
- E3:F3 = TRA #8169
- G3:I3 = BRAND: <store brand>
- J3:K3 = STO # <entered STO#>
- L3:O3 = QTY: <scanner total>

The PAIRING SUMMARY remains in Q:R.

Store dropdown labels remain the requested labels.

Test URL: http://127.0.0.1:3034/
