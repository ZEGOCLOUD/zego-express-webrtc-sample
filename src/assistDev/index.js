import { checkAnRun, previewVideo } from '../common';
import { getBrowser } from '../assets/utils';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
let zg
let appID
let server = "none"
$('#userId').val('sample' + new Date().getTime())
const userName = 'sampleUser' + new Date().getTime();

let cgiToken = '';
let isPreviewed = false;

let playOption = {};
// --test begin
let previewStream;
let published = false;
$('#streamId').val('web-' + new Date().getTime())
let isLogin = false;
// ---test end

// $("#appId").val(1739272706)
// $("#serverUrl").val("wss://wssliveroom-test.zego.im/ws")
// $("#token").val("")

$(async () => {
    await checkAnRun();

    $('#publish').click(async () => {
        if (!isLogin) {
            alert('Please log in room first')
            return
        }
        previewStream = await zg.createStream({
            camera: {
                video: true,
                audio: true,
            },
        });
        previewVideo.srcObject = previewStream;
        isPreviewed = true;
        previewVideo.controls = true;
        const result = zg.startPublishingStream($('#streamId').val(), previewStream ? previewStream : previewVideo.srcObject);
        published = true;
        console.log('publish stream' + $('#streamId').val(), result);
    });



    $('#leaveRoom').unbind('click');
    $('#leaveRoom').click(async () => {
        if (isPreviewed) {
            zg.destroyStream(previewStream);
            isPreviewed = false;
            previewVideo.srcObject = null;
        }
        if (published) {
            zg.stopPublishingStream($('#streamId').val());
            published = false;
        }

        await logout();
        isLogin = false
    });

    $('#stopPublish').unbind('click');
    $('#stopPublish').click(async () => {
        if (isPreviewed) {
            zg.destroyStream(previewStream);
            isPreviewed = false;
            previewVideo.srcObject = null;
        }
        if (published) {
            zg.stopPublishingStream($('#streamId').val());
            published = false;
        }
    });

    $('#openRoom').unbind('click');
    $('#openRoom').click(async () => {
        console.log('$(#appId)', $('#appId'));
        const currentId = $('#appId').val()
        if (!currentId) {
            alert('AppID is empty')
            return
        } else if (isNaN(Number(currentId))) {
            alert('AppID must be number')
            return
        }

        if (isLogin) {
            alert('Already login. please login after logout current room.')
            return
        }
        appID = Number(currentId);
        resetInstance(appID)
        isLogin = await enterRoom();
        if(isLogin) {
            alert("Login Success!")
        }
    });


});

let lastInfo = {
}
function resetInstance(appId) {
    if (appId !== lastInfo.appId) {
        zg && zg.off('roomStreamUpdate');
        if(zg) {
            zg.logoutRoom()
        }
        zg = new ZegoExpressEngine(Number(appId), server)
        zg.on('roomStreamUpdate', async (roomID, updateType, streamList, extendedData) => {
            console.log('roomStreamUpdate 2 roomID ', roomID, streamList, extendedData);
            if (updateType == 'ADD') {
                for (let i = 0; i < streamList.length; i++) {
                    console.info(streamList[i].streamID + ' was added');
                    let remoteStream;

                    const handlePlaySuccess = (streamItem) => {
                        let video;
                        const bro = getBrowser();
                        if (bro == 'Safari' && playOption.video === false) {
                            $('.remoteVideo').append($(`<audio id=${streamItem.streamID} autoplay muted playsinline controls></audio>`));
                            video = $('.remoteVideo audio:last')[0];
                            console.warn('audio', video, remoteStream);
                        } else {
                            $('.remoteVideo').append($(`<video id=${streamItem.streamID} autoplay muted playsinline controls></video>`));
                            video = $('.remoteVideo video:last')[0];
                            console.warn('video', video, remoteStream);
                        }

                        video.srcObject = remoteStream;
                        video.muted = false;
                    };

                    playOption = {};
                    const _selectMode = $('#playMode option:selected').val();
                    console.warn('playMode', _selectMode, playOption);
                    if (_selectMode) {
                        if (_selectMode == 'all') {
                            playOption.video = true;
                            playOption.audio = true;
                        } else if (_selectMode == 'video') {
                            playOption.audio = false;
                        } else if (_selectMode == 'audio') {
                            playOption.video = false;
                        }
                    }

                    zg.startPlayingStream(streamList[i].streamID, playOption).then(stream => {
                        remoteStream = stream;
                        useLocalStreamList.push(streamList[i]);
                        handlePlaySuccess(streamList[i]);
                    }).catch(error => {
                        console.error(error);

                    })
                }
            } else if (updateType == 'DELETE') {
                for (let k = 0; k < useLocalStreamList.length; k++) {
                    for (let j = 0; j < streamList.length; j++) {
                        if (useLocalStreamList[k].streamID === streamList[j].streamID) {
                            try {
                                zg.stopPlayingStream(useLocalStreamList[k].streamID);
                            } catch (error) {
                                console.error(error);
                            }

                            console.info(useLocalStreamList[k].streamID + 'was devared');


                            $('.remoteVideo video:eq(' + k + ')').remove();
                            useLocalStreamList.splice(k--, 1);
                            break;
                        }
                    }
                }
            }
        });
    }
    lastInfo.appId = appId
}

async function enterRoom() {
    const roomId = $('#roomId').val();
    if (!roomId) {
        alert('roomId is empty');
        return false;
    }

    for (let i = 0; i < useLocalStreamList.length; i++) {
        useLocalStreamList[i].streamID && zg.stopPlayingStream(useLocalStreamList[i].streamID);
    }

    $('.remoteVideo').html('');

    return await login(roomId).catch(err => {
        const errStr = JSON.stringify(err)
        if([1102016].includes(err.code)) {
            alert("Token 错误，请查看您在页面中填写的 UserID、AppID是否与生成 Token 时所用到的一致。\n Token error, please check whether the userid and appid you filled in the page are consistent with those used in generating token.")
        } else  if(err.code === 1102018) {
            alert ("Token 过期。 \n Token expire.")
        } else {
            alert("Login failed! " + errStr)
        }
        throw err
    });
}

async function login(roomId) {
    // 获取token需要客户自己实现，token是对登录房间的唯一验证
    // Obtaining a token needs to be implemented by the customer. The token is the only verification for the login room.
    let token = $("#token").val() || "";
    let userID = $("#userId").val() || "";
    return await zg.loginRoom(roomId, token, { userID, userName }, { userUpdate: true });
}


async function logout() {
    console.info('leave room  and close stream');
    if (previewVideo.srcObject) {
        previewVideo.srcObject = null;
    }

    // 停止推流
    // stop publishing
    if (isPreviewed) {
        zg.stopPublishingStream(publishStreamId);
        zg.destroyStream(localStream);
        isPreviewed = false;
        previewVideo.srcObject = null;
        !$('.sound').hasClass('d-none') && $('.sound').addClass('d-none');
    }

    // 停止拉流
    // stop playing
    for (let i = 0; i < useLocalStreamList.length; i++) {
        useLocalStreamList[i].streamID && zg.stopPlayingStream(useLocalStreamList[i].streamID);
    }

    // 清空页面
    // Clear page
    useLocalStreamList = [];
    // window.useLocalStreamList = [];
    $('.remoteVideo').html('');
    $('#memberList').html('');

    //退出登录
    //logout
    const roomId = $('#roomId').val();
    zg.logoutRoom(roomId);
    isLogin = false;
}