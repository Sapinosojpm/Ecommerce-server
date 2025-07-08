import passport from 'passport';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import dotenv from 'dotenv';
dotenv.config();

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || `${process.env.BACKEND_URL}/api/auth/facebook/callback`,
    profileFields: ['id', 'displayName', 'emails'],
    enableProof: true,
    scope: ['email', 'pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
    state: true
  },
  function(accessToken, refreshToken, profile, done) {
    // Store the accessToken with the profile
    const user = {
      ...profile,
      accessToken: accessToken
    };
    return done(null, user);
  }
));

export default passport;