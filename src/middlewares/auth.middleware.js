import jwt from "jsonwebtoken";
import { ApiError } from "../utlis/ApiError";
import { asyncHandler } from "../utlis/asyncHandler";
import { User } from "../models/user.models";


export const verifyJWT = asyncHandler (async (req, res, next) =>{
   try {
    const token =  req.cookies?.accessToken ||
     req.header("Authorization")?.replace("Bearer ", "")
 
     if(!token){
         throw new ApiError(401,"Unauthorized access")
     }
 
     const decodeToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
 
     const user = await User.findById(decodeToken?._id.select
         ("-password -refreshToken")
     )
 
     if(!user){
         throw new ApiError(401, "Invalid access token")
     }
 
     req.user = user;
     next()
   } catch (error) {
    throw new ApiError(401, error?.message || "Invlaid access token")
   }

})