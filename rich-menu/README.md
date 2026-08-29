# Rich Menu — Moda Coffee

ปุ่มลัด 3 ปุ่มด้านล่างแชท LINE OA: **เมนู/สินค้า** · **เวลาเปิด-ปิด** · **ที่ตั้ง**

## สิ่งที่ต้องเตรียมเอง

- `rich-menu.jpg` — รูปปุ่มเมนู ขนาด **2500 x 843 px** (ตรงกับ `size` ใน `rich-menu.json`)
  วางไว้ในโฟลเดอร์นี้ (`rich-menu/rich-menu.jpg`)
  - แบ่ง 3 คอลัมน์เท่ากัน (แต่ละคอลัมน์กว้าง ~833px) ให้ตรงกับ `areas` ใน `rich-menu.json`
  - export เป็น `.jpg` เท่านั้น (LINE ไม่รับ PNG แบบโปร่งใส)
  - ใช้โทนสีแบรนด์ Moda Coffee + ไอคอน/ข้อความสั้นๆ ต่อปุ่ม

## ปุ่มที่ตั้งไว้ (แก้ได้ใน `rich-menu.json`)

| ปุ่ม | ข้อความที่ส่งเมื่อกด | ตรงกับ FAQ |
|---|---|---|
| เมนู/สินค้า | "เมนูมีอะไรบ้าง" | หมวด "เมนู" |
| เวลาเปิด-ปิด | "เปิดกี่โมง" | หมวด "เวลา" |
| ที่ตั้ง | "ร้านอยู่ไหน" | หมวด "ที่ตั้ง" |

> อยากเพิ่มปุ่ม (เช่น "จองโต๊ะ" หรือ "โปรโมชั่น") — เพิ่ม object ใน `areas` ของ `rich-menu.json`
> แล้วปรับ layout รูปให้ตรงกัน (พิกัด `bounds` หน่วยเป็น px อ้างอิงจากมุมบนซ้าย)

## วิธีติดตั้ง

```bash
# ต้องมี LINE_CHANNEL_ACCESS_TOKEN ใน env ก่อนรัน (หรือใช้ npm script ที่โหลดจาก .env.local ให้แล้ว)
npm run install-rich-menu
```

Script จะ: สร้าง rich menu → อัปโหลดรูป → ตั้งเป็น default ให้ผู้ใช้ทุกคน แล้ว print `richMenuId` ออกมา

## ลบ/เปลี่ยน Rich Menu ทีหลัง

ถ้าต้องการเปลี่ยนรูปหรือปุ่มใหม่ ให้แก้ `rich-menu.json` + เตรียมรูปใหม่ แล้วรัน `npm run install-rich-menu` ซ้ำ
(LINE จะสร้าง rich menu ใหม่ทุกครั้งที่รัน — ถ้าอยากลบอันเก่า ใช้ LINE Official Account Manager หรือ Messaging API `DELETE /v2/bot/richmenu/{richMenuId}`)
