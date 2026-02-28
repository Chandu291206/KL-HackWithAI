import React, { useState, useEffect } from 'react';

const TextType = ({
    texts,
    text,
    typingSpeed = 75,
    pauseDuration = 1500,
    showCursor = true,
    cursorCharacter = '_',
    deletingSpeed = 50,
}) => {
    const displayTexts = texts && texts.length > 0 ? texts : (text ? text : []);
    const [textIndex, setTextIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentText, setCurrentText] = useState('');

    useEffect(() => {
        if (!displayTexts || displayTexts.length === 0) return;

        const fullCurrentText = displayTexts[textIndex];

        const type = () => {
            if (isDeleting) {
                setCurrentText(fullCurrentText.substring(0, charIndex - 1));
                setCharIndex((prev) => prev - 1);
            } else {
                setCurrentText(fullCurrentText.substring(0, charIndex + 1));
                setCharIndex((prev) => prev + 1);
            }
        };

        let timeout;
        if (isDeleting) {
            if (charIndex === 0) {
                setIsDeleting(false);
                setTextIndex((prev) => (prev + 1) % displayTexts.length);
                timeout = setTimeout(type, 500);
            } else {
                timeout = setTimeout(type, deletingSpeed);
            }
        } else {
            if (charIndex === fullCurrentText.length) {
                timeout = setTimeout(() => setIsDeleting(true), pauseDuration);
            } else {
                timeout = setTimeout(type, typingSpeed);
            }
        }

        return () => clearTimeout(timeout);
    }, [charIndex, isDeleting, textIndex, displayTexts, typingSpeed, deletingSpeed, pauseDuration]);

    if (!displayTexts || displayTexts.length === 0) return null;

    return (
        <div className="text-lg font-medium text-slate-800">
            {currentText}
            {showCursor && (
                <span className="animate-pulse">{cursorCharacter}</span>
            )}
        </div>
    );
};

export default TextType;
