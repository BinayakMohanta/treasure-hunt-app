import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import QrScanner from 'react-qr-scanner';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const socket = io(API_URL);

// --- SVG ICONS ---
const CameraIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>;
const QRIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><line x1="14" y1="14" x2="14" y2="21"></line><line x1="21" y1="14" x2="21" y2="21"></line><line x1="14" y1="14" x2="21" y2="14"></line></svg>;
const TrophyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>;
const Spinner = () => <div className="spinner"></div>;

// --- COMPONENT FOR DISPLAYING RIDDLES AND SCANNING ---
const RiddleScreen = ({ teamData, onScanResult }) => {
    const [isScanning, setIsScanning] = useState(false);
    const [activeTab, setActiveTab] = useState('current');
    const [errorMessage, setErrorMessage] = useState('');

    const handleScan = (data) => {
        if (data) {
            setIsScanning(false);
            onScanResult(data.text);
        }
    };
    const handleScanError = (err) => {
        console.error(err);
        setErrorMessage("Could not access camera. Please check permissions.");
        setIsScanning(false);
    };

    if (isScanning) {
        return (
            <div className="scanner-container">
                <h2>Scan QR Code</h2>
                <div className="scanner-viewport">
                    <QrScanner
                        delay={300}
                        onError={handleScanError}
                        onScan={handleScan}
                        style={{ width: '100%' }}
                        constraints={{ video: { facingMode: "environment" } }}
                    />
                    <div className="scanner-overlay">
                        <div className="scanner-line"></div>
                    </div>
                </div>
                <button onClick={() => setIsScanning(false)} className="cancel-scan-button">Cancel</button>
            </div>
        );
    }
    
    return (
        <div className="game-screen fade-in">
            <h2 className="game-title">The Hunt is On!</h2>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
            <div className="tabs">
                <button onClick={() => setActiveTab('current')} className={activeTab === 'current' ? 'active' : ''}>Current Riddle</button>
                <button onClick={() => setActiveTab('past')} className={activeTab === 'past' ? 'active' : ''}>Past Riddles</button>
            </div>
            {activeTab === 'current' ? (
                <div className="riddle-card current-riddle">
                    <p>{teamData.currentRiddle || "Your first riddle is waiting... Scan the starting QR code!"}</p>
                </div>
            ) : (
                <div className="riddle-card past-riddles">
                    {teamData.riddlesSolved && teamData.riddlesSolved.length > 0 ? (
                        <ul>
                            {teamData.riddlesSolved.map((item, index) => (
                                <li key={index}><strong>{item.location}:</strong> {item.riddle}</li>
                            ))}
                        </ul>
                    ) : <p>No past riddles yet.</p>}
                </div>
            )}
            <button onClick={() => { setIsScanning(true); setErrorMessage(''); }} className="scan-button">
                <QRIcon />
                <span>Scan Next Clue</span>
            </button>
        </div>
    );
};

// --- COMPONENT FOR CAPTURING AND UPLOADING SELFIES ---
const SelfieScreen = ({ teamData, onUploadSuccess }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [status, setStatus] = useState('pending'); // 'pending', 'uploading', 'waiting'
    const webcamRef = useRef(null);

    const capture = useCallback(() => {
        const image = webcamRef.current.getScreenshot();
        setImageSrc(image);
    }, [webcamRef]);
    const retakePhoto = () => setImageSrc(null);

    const handleUpload = async () => {
        if (!imageSrc || status === 'uploading') return;
        setStatus('uploading');
        try {
            const response = await fetch(`${API_URL}/api/teams/upload-selfie`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamCode: teamData.teamCode, imageSrc }),
            });
            if (response.ok) {
                setStatus('waiting');
                onUploadSuccess(); 
            } else {
                 const data = await response.json();
                 alert(data.message || 'Upload failed. Please try again.');
                 setStatus('pending');
            }
        } catch (error) {
            alert('Upload failed. Please try again.');
            setStatus('pending');
        }
    };
    
    const statusMessages = {
        pending: 'Take a team selfie for verification.',
        uploading: 'Uploading your proof...',
        waiting: 'Selfie submitted! Waiting for admin approval...'
    };

    return (
         <div className="selfie-screen fade-in">
            <h2>Checkpoint Verification</h2>
            <p className="status-message">{statusMessages[status]}</p>
            <div className="webcam-container">
                {imageSrc ? <img src={imageSrc} alt="Team Selfie" /> : <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ width: 400, height: 400, facingMode: "user" }} />}
                {status === 'waiting' && <div className="waiting-overlay"><Spinner /></div>}
            </div>
            <div className="selfie-controls">
                {imageSrc ? (
                    <>
                        <button onClick={handleUpload} disabled={status !== 'pending'}>{status === 'uploading' ? 'Uploading...' : 'Upload for Verification'}</button>
                        <button onClick={retakePhoto} className="retake-button" disabled={status !== 'pending'}>Retake</button>
                    </>
                ) : (
                    <button onClick={capture} className="capture-button">
                        <CameraIcon/>
                        <span>Capture Photo</span>
                    </button>
                )}
            </div>
        </div>
    );
};

// --- MAIN CONTROLLER COMPONENT FOR PARTICIPANTS ---
const ParticipantView = ({ teamData: initialTeamData }) => {
    const [teamData, setTeamData] = useState(initialTeamData);
    
    useEffect(() => {
        const handleTeamUpdate = (updatedTeamFromServer) => {
            if(updatedTeamFromServer.teamCode === initialTeamData.teamCode) {
                setTeamData(updatedTeamFromServer);
            }
        };
        socket.on('teamUpdate', handleTeamUpdate);

        const handleSelfieRejected = () => {
             alert("Your selfie was rejected by the admin. Please retake and upload a new one.");
             setTeamData(prev => ({...prev, selfie: { url: "", isVerified: false }}));
        };
        socket.on(`selfieRejected_${initialTeamData.teamCode}`, handleSelfieRejected);
        
        return () => {
            socket.off('teamUpdate', handleTeamUpdate);
            socket.off(`selfieRejected_${initialTeamData.teamCode}`, handleSelfieRejected);
        };
    }, [initialTeamData.teamCode]);

    const handleScanResult = async (qrIdentifier) => {
        try {
            const response = await fetch(`${API_URL}/api/teams/scan-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamCode: teamData.teamCode, qrIdentifier }),
            });
            if (!response.ok) {
                 const data = await response.json();
                 alert(data.message || "An error occurred.");
            }
        } catch (error) {
            alert("Failed to connect to the server.");
        }
    };
    
    if (teamData.endTime) {
        const startTime = new Date(teamData.startTime);
        const endTime = new Date(teamData.endTime);
        const diff = endTime.getTime() - startTime.getTime();
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        const finalTime = `${hours}h ${minutes}m ${seconds}s`;

        return (
            <div className="completion-screen fade-in">
                <TrophyIcon />
                <h2>Congratulations, {teamData.teamName}!</h2>
                <p>You have completed the Treasure Hunt!</p>
                <div className="final-time-card">
                    <h3>Final Time</h3>
                    <p>{finalTime}</p>
                </div>
            </div>
        );
    }
    
    if (teamData.selfie && teamData.selfie.isVerified) {
        return <RiddleScreen teamData={teamData} onScanResult={handleScanResult} />;
    } else {
        return <SelfieScreen teamData={teamData} onUploadSuccess={() => setTeamData(prev => ({...prev, selfie: {...(prev.selfie || {}), url: "PENDING"}}))}/>;
    }
};

export default ParticipantView;
