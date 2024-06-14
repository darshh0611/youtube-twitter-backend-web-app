import {asyncHandler} from "../utlis/asyncHandler.js"
import {ApiError} from "../utlis/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utlis/coludinary.js"
import ApiResponse from "../utlis/Api.Response.js"

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

export {registerUser}