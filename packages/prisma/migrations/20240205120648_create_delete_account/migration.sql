-- Create deleted@tiquo.co
DO $$
BEGIN  
  IF NOT EXISTS (SELECT 1 FROM "public"."User" WHERE "email" = 'deleted-account@tiquo.co') THEN  
    INSERT INTO
      "public"."User" (
        "email",
        "emailVerified",
        "password",
        "createdAt",
        "updatedAt",
        "lastSignedIn",
        "roles",
        "identityProvider",
        "twoFactorEnabled"
      )
    VALUES
      (
        'deleted-account@tiquo.co',
        NOW(),
        NULL,
        NOW(),
        NOW(),
        NOW(),
        ARRAY['USER'::TEXT]::"public"."Role" [],
        CAST('GOOGLE'::TEXT AS "public"."IdentityProvider"),
        FALSE
      );
  END IF;  
END $$
