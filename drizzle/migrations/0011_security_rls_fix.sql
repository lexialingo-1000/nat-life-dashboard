-- Fix critique : activer RLS sur marche_lot_affectations (deny-by-default, identique aux autres tables)
ALTER TABLE public.marche_lot_affectations ENABLE ROW LEVEL SECURITY;

-- Fix WARN : trigger function ne doit pas être appelable directement via REST API
-- PUBLIC inclut anon + authenticated — révoquer PUBLIC suffit
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
