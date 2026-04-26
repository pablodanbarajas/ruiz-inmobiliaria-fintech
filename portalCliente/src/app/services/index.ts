/**
 * Registro central de servicios activos.
 *
 * Este es el ÚNICO archivo que decide qué implementación usar.
 * Para pasar de mock a Supabase real:
 *   1. Crear los servicios en services/supabase/
 *   2. Reemplazar las importaciones aquí abajo
 *   3. Sin tocar ningún componente, página o contexto
 *
 * Ejemplo futuro:
 *   import { supabaseAuthService }    from './supabase/auth.service';
 *   import { supabaseDevelopmentsService } from './supabase/developments.service';
 *   ...
 *   export const authService        = supabaseAuthService;
 *   export const developmentsService = supabaseDevelopmentsService;
 */

import { supabaseAuthService }         from './supabase/auth.service';
import { supabaseDevelopmentsService } from './supabase/developments.service';
import { supabaseLotsService }         from './supabase/lots.service';
import { supabasePaymentsService }     from './supabase/payments.service';
import { supabaseSupportService }      from './supabase/support.service';

export const authService         = supabaseAuthService;
export const developmentsService = supabaseDevelopmentsService;
export const lotsService         = supabaseLotsService;
export const paymentsService     = supabasePaymentsService;
export const supportService      = supabaseSupportService;