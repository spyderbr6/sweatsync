//import { useEffect, useState } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
//import { uploadData, getUrl } from 'aws-amplify/storage';

function ProfilePage() {
  const { user } = useAuthenticator();
  //const [profilePicture, setProfilePicture] = useState<File | null>(null);
 //const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);


 //FIGURE OUT HOW TO EXTEND models.d.ts to grab pics/emails/etc
 //        <p><strong>Username:</strong> {user?.username}</p>
 //<p><strong>Email:</strong> {user?.email}</p>
// <p><strong>Preferred Name:</strong> {user?.preferred_username || user?.username}</p>
  

  return (
    <div className="profile-page">
      <h1>{user?.username}'s Profile</h1>
      <div className="profile-info">
        {user?.username ? (
          <img src={user?.username} alt="Profile" className="profile-picture" />
        ) : (
          <div className="profile-picture-placeholder">No profile picture</div>
        )}
        <button>Upload Profile Picture</button>
        <p><strong>Username:</strong> {user?.username}</p>
        <p><strong>Email:</strong> {user?.username}</p>
        <p><strong>Preferred Name:</strong> {user?.username || user?.username}</p>
      </div>
    </div>
  );
}

export default ProfilePage;
