-- The portal's support page now links to WhatsApp, phone and email instead of
-- a message form. No admin screen ever showed these messages, and the insert
-- policy let anyone, even without an account, write into the table.
--
-- The table and its rows stay for reference; only new writes are closed.
-- Apply in Prod together with the portal release that removes the form, so
-- clients never see an error on the old form.
DROP POLICY IF EXISTS insertar_tickets_soporte ON public.soporte_ticket;
DROP POLICY IF EXISTS leer_mis_tickets_soporte ON public.soporte_ticket;
REVOKE INSERT, UPDATE, DELETE ON public.soporte_ticket FROM anon, authenticated;
