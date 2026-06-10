---
name: update-claude
description: Update CLAUDE.md and docs/history.md to reflect recent changes — list changes first, wait for confirm, then write
triggers:
  - "update-claude"
  - "อัพเดต claude"
  - "อัปเดต claude"
  - "update claude"
---

## Steps

1. **วิเคราะห์การเปลี่ยนแปลง** — ดู git log ตั้งแต่ docs update ครั้งล่าสุด
2. **List ให้ผู้ใช้ confirm** — จัดเป็นหมวด: UI/Redesign · Features · Bug fixes · Config/Setup
3. **รอ confirm** — ก่อน write ไฟล์
4. **อัปเดต CLAUDE.md** — เฉพาะ sections ที่เปลี่ยน, ห้ามเพิ่ม changelog, ~120 บรรทัด (เกินนิดหน่อยได้)
5. **อัปเดต docs/history.md** — prepend `## Changelog — vX.Y (YYYY-MM-DD)` พร้อม bullet points
6. **อัปเดต README.md** — ถ้ามี feature ใหม่ที่ user-facing
7. **Commit** — message: `docs: update CLAUDE.md, README, history for vX.Y`

## Version numbering

ดูจาก `docs/history.md` — changelog ล่าสุดคือเวอร์ชันอะไร แล้ว bump minor (2.9 → 2.10, ไม่ใช่ 3.0)

## Bullet format ใน history.md

- `F:` = Feature ใหม่
- `U:` = UI/UX update
- `B:` = Bug fix
- `C:` = Config/Setup/Schema change

## CLAUDE.md rules

- อัปเดตเฉพาะ sections ที่เปลี่ยนจริง — ห้ามเขียน changelog ลงใน CLAUDE.md
- ถ้าเพิ่ม section ใหม่ให้ตัด section เก่าที่ล้าสมัยออก
- ~120 บรรทัด — เกินนิดหน่อยได้ ไม่ต้องตัดเนื้อหาสำคัญออกเพื่อให้พอดี
