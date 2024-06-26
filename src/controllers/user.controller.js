import {asyncHandler} from "../utlis/asyncHandler.js"
import {ApiError} from "../utlis/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utlis/coludinary.js"
import ApiResponse from "../utlis/Api.Response.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while geenrating refresh and access token.")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    // steps
    // get user details from frontend
    // validation
    // check if user already exists : username, email
    // check for images, check for avatar
    // upload images to cloudinary, avatar
    // create user object - create a entry in mongodb
    // remove password and refresh token field from response
    // check for user creation
    // return response

    const {fullname, email, username, password} = req.body
    console.log({
        "email": email,
        "password": password
    });


    // if (fullname === "") {
    //     throw new ApiError(400, "Fullname is required");
    // } check for all conditions like this (newbie method)

    if (
        [fullname, email, username, password].some((field) => 
        field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
        }

    const existUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if(existUser) {
        throw new ApiError(409, "This user already exists.")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && req.files.coverImage && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required.")
    }

   const avatar = await uploadOnCloudinary(avatarLocalPath);
   const coverImage = await uploadOnCloudinary(coverImageLocalPath);

   if(!avatar){
    throw new ApiError(400, "Avatar file is required.")
}

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser  = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while creating the user.")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    );


})  

const loginUser = asyncHandler( async (req, res) => {
 //Steps
 //Data from request body
 //Username or email based login
 //Find the user
 //If yes, check for password match. 
 //If user not found, give User not registered error. 
 //If user is found but password do not match, give password error.
 //If password is correct, give access and refresh tokens to the user.
 //Send the tokens in cookies(secure).

    const {email, username, password} = req.body;
    if(!username && !email){
    throw new ApiError(400, "Username or email is required.")
    }
    const user = await User.findOne({
        $or: [{username}, {email}]
    })
    
    if(!user) {
        throw new ApiError(404, "User does not exist.")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "The password is incorrect.")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true,
    }
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, {
            user: loggedInUser, accessToken,
            refreshToken
        },
        "User logged in successfully."
        )
    )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request.");
    }
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?._id);
        if(!user){
            throw new ApiError(401, "Invalid refresh token.")
        }
    
        if(incomingRefreshToken !== decodedToken){
            throw new ApiError(401, "Refresh token is expired or used.");
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const{accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id);
    
        res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(new ApiResponse(200, {accessToken, refreshToken: newRefreshToken}, "Refresh token generated."))
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token.")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const{oldPassword, newPassword} = req.body;
    const user = await User.findById(req.user._id);
    const checkPassword = await user.isPasswordCorrect(oldPassword);
    
    if(!checkPassword){
        throw new ApiError(400, "Old password is incorrect.")
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res.status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully."))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200)
    .json(200, req.user, "Current user fetched succcessfully.")
})

const updateAccountDetails = asyncHandler(async (req, res) =>{
    const{fullname, email} = req.body;

    if(!fullname || !email){
        throw new ApiError(402, "All fields are required.")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                fullname,
                email: email
            }
        },
        {new: true}
    ).select("-password")
    return res.status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully."))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocal = req.file?.path;

    if(!avatarLocal){
        throw new ApiError(401, "File is missing.")
    }

    const avatar = await uploadOnCloudinary(avatarLocal);
    if(!avatar.url){
        throw new ApiError(401, "Something went wrong while uploading.")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {avatar: avatar.url},
        {new: true}
    ).select("-password")

    res.status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully."))
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocal = req.file?.path;

    if(!coverImageLocal){
        throw new ApiError(401, "File is missing.")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocal);
    if(!coverImage.url){
        throw new ApiError(401, "Something went wrong while uploading.")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {coverImage: coverImage.url},
        {new: true}
    ).select("-password")

    res.status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully."))
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {username} = req.params;

    if(!username?.trim()){
        throw new ApiError(400, "Username is missing")
    }

    const channel = await User.aggregate([{
        $match: {
            username: username?.toLowerCase()
        }
    },
    {
        $lookup:{
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
        }
    },
    {
        $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "subscriber",
            as: "subscribedTo"
        }
    },
    {
        $addFields:{
            subcribersCount:{
                $size: "$subscribers"
            },
            subscribedToCount: {
                $size: "$subscribedTo"
            },
            isSubscribed:{
                $con:{
                    if:{$in: [req.user?._id, "$subscribers.subscriber"]},
                    then: true,
                    else: false
                }
            }
        }
    },
    {
        $project: {
            fullname: 1,
            username: 1,
            avatar: 1,
            coverImage: 1,
            subcribersCount: 1,
            subscribedToCount: 1,
            isSubscribed: 1,
            email: 1,
            createdAt: 1
        }
    }

    ])

    if(!channel?.length){
        throw new ApiError(404, "Channle does not exist.")
    }

    return res.status(200).json(new ApiResponse(200, channel[0], "Channel is fetched."))
})




export {registerUser, 
        loginUser,
        logoutUser, 
        refreshAccessToken,
        changeCurrentPassword, 
        getCurrentUser, 
        updateAccountDetails,
        updateUserAvatar,
        updateUserCoverImage,
        getUserChannelProfile
    }