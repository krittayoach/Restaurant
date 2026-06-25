import { Elysia } from 'elysia'
import { verifyJWT } from '../lib/jwt'
import type { Role } from '../types'

// ─── Auth Guard Plugin ────────────────────────────────────────────────────────
//
// ใช้ .use(authGuard()) ใน route group ที่ต้องการ JWT
//
// หลังจาก use แล้ว context จะมี:
//   ctx.userId       — user id จาก token
//   ctx.userRole     — role จาก token
//   ctx.restaurantId — restaurant id จาก token
//
// ถ้า token ไม่ valid จะ throw 401 ทันที

export const authGuard = (allowedRoles?: Role[]) =>
  new Elysia({ name: 'auth-guard' })
    .derive(async ({ headers, cookie, set }) => {
      // รองรับทั้ง Authorization header และ httpOnly cookie
      const authHeader = headers['authorization']
      const cookieToken = cookie?.['token']?.value

      const raw = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : cookieToken

      if (!raw) {
        set.status = 401
        throw new Error('Unauthorized: missing token')
      }

      let payload: Awaited<ReturnType<typeof verifyJWT>>
      try {
        payload = await verifyJWT(raw as string)
      } catch {
        set.status = 401
        throw new Error('Unauthorized: invalid token')
      }

      const role = payload.role as Role

      if (allowedRoles && !allowedRoles.includes(role)) {
        set.status = 403
        throw new Error(`Forbidden: requires one of [${allowedRoles.join(', ')}]`)
      }

      return {
        userId:       payload.userId,
        userRole:     role,
        restaurantId: payload.restaurantId ?? '',
      }
    })

// ─── Role Guards (convenience) ────────────────────────────────────────────────

/** Manager only */
export const managerGuard = () => authGuard(['manager', 'super_admin'])

/** Manager + Employee */
export const staffGuard = () => authGuard(['manager', 'employee', 'super_admin'])

/** Chef only */
export const chefGuard = () => authGuard(['chef', 'manager', 'super_admin'])

/** Any authenticated staff */
export const anyStaffGuard = () => authGuard(['super_admin', 'manager', 'employee', 'chef'])
