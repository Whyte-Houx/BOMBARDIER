local KEYS_LOCAL = rawget(_G, "KEYS") or {}
local ARGV_LOCAL = rawget(_G, "ARGV") or {}
local redis_local = rawget(_G, "redis")

local key = KEYS_LOCAL[1]
local now = tonumber(ARGV_LOCAL[1])
local window = tonumber(ARGV_LOCAL[2])
local limit = tonumber(ARGV_LOCAL[3])
redis_local.call("ZREMRANGEBYSCORE", key, 0, now - window)
local count = redis_local.call("ZCARD", key)
if count >= limit then
  return 0
end
redis_local.call("ZADD", key, now, tostring(now))
redis_local.call("EXPIRE", key, window)
return 1