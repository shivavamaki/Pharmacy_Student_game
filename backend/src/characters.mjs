import {AuthError} from './auth.mjs';
import {normalizeCharacter} from '../../frontend/character-model.mjs';
export async function characterFor(db,profileId){try{const row=await db.prepare('SELECT * FROM characters WHERE profile_id=?').bind(profileId).first();return row?{...normalizeCharacter({...row,classKey:row.class_key}),version:row.version,createdAt:row.created_at,updatedAt:row.updated_at}:null;}catch(error){if(/no such table.*characters/i.test(String(error)))throw new AuthError('character_migration_required',503);throw error;}}
export async function requireCharacter(db,profile){if(!await characterFor(db,profile.id))throw new AuthError('avatar_required',409);}
export const characterGuard=p=>({sql:'EXISTS(SELECT 1 FROM characters WHERE profile_id=?)',args:[p.id]});
export const partyAvatarSQL="NOT EXISTS(SELECT 1 FROM party_members cm JOIN profiles cp ON cp.id=cm.profile_id LEFT JOIN characters c ON c.profile_id=cp.id WHERE cm.party_id=? AND cp.role='student' AND cp.status='active' AND c.profile_id IS NULL)";
