-- Viewport reads compare the persisted point in the geometry domain: a
-- geography envelope cannot represent edges of 180 degrees or more, which a
-- world bbox would produce. This expression index keeps those reads indexed.
create index messages_public_point_geometry_gix
  on app_private.messages
  using gist ((public_point::geometry));