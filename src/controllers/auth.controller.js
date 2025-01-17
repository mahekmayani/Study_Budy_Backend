const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { authService, userService, tokenService, emailService } = require('../services');
const Joi = require('joi');
const { password } = require('../validations/custom.validation');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');

const register = {
  validation: {
    body: Joi.object().keys({
      email: Joi.string().required().email(),
      password: Joi.string().required().custom(password),
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      phone: Joi.string().required(),
    }),
  },
  handler: async (req, res) => {
    // check if email is already registered
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User already registered');
    }
    // create user
    const newUser = await new User(req.body).save();
    const token = await tokenService.generateAuthTokens(newUser);
    return res.status(httpStatus.CREATED).send({ token, user: newUser });
  }
};

const login = {
  validation: {
    body: Joi.object().keys({
      email: Joi.string().required().email(),
      password: Joi.string().required(),
    }),
  },
  handler: async (req, res) => {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || !(await user.isPasswordMatch(password))) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
    }

    const token = await tokenService.generateAuthTokens(user);
    return res.status(httpStatus.OK).send({ token, user });
}
};

const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const refreshTokens = catchAsync(async (req, res) => {
  const tokens = await authService.refreshAuth(req.body.refreshToken);
  res.send({ ...tokens });
});

const forgotPassword = catchAsync(async (req, res) => {
  const resetPasswordToken = await tokenService.generateResetPasswordToken(req.body.email);
  await emailService.sendResetPasswordEmail(req.body.email, resetPasswordToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.query.token, req.body.password);
  res.status(httpStatus.NO_CONTENT).send();
});

const sendVerificationEmail = catchAsync(async (req, res) => {
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(req.user);
  await emailService.sendVerificationEmail(req.user.email, verifyEmailToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const verifyEmail = catchAsync(async (req, res) => {
  await authService.verifyEmail(req.query.token);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  register,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
};
