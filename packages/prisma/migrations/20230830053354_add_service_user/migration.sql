INSERT INTO "User" ("email", "name") VALUES (
  'serviceaccount@tiquo.co',
  'Service Account'
) ON CONFLICT DO NOTHING;
