import jwt from 'jsonwebtoken';

const generateToken = (payloadOrId) => {
  const payload =
    payloadOrId && typeof payloadOrId === 'object'
      ? payloadOrId
      : { id: payloadOrId };

  return jwt.sign(payload, process.env.JWT_SECRET || 'defaultsecret', {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

export default generateToken;
