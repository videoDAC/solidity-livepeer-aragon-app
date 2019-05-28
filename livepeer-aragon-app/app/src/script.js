import '@babel/polyfill'
import AragonApi from '@aragon/api'
import {
    controllerAddress$,
    livepeerTokenAddress$,
    livepeerAragonApp$,
    livepeerToken$,
    bondingManagerAddress$,
    bondingManager$,
    roundsManager$,
    jobsManager$,
    serviceRegistry$
} from '../web3/ExternalContracts'
import {range, of} from "rxjs";
import {first, mergeMap, map, filter, toArray, zip, tap, merge, catchError} from "rxjs/operators"
import {ETHER_TOKEN_FAKE_ADDRESS} from "../SharedConstants";

const ACCOUNT_CHANGED_EVENT = Symbol("ACCOUNT_CHANGED")

const api = new AragonApi()
api.identify('Livepeer App')
let livepeerAppAddress = "0x0000000000000000000000000000000000000000"

//TODO: Add retryEvery function
//TODO: Rearrange Transcoder UI, add boxes to other tabs.
//TODO: More disabling of buttons/error handling when functions can't be called.
//TODO: Add menu hamburger to smaller view.
//TODO: Add withdraw eth function.

const initialState = async (state) => {
    return {
        ...state,
        livepeerTokenAddress: await livepeerTokenAddress$(api).toPromise(),
        livepeerControllerAddress: await controllerAddress$(api).toPromise(),
        appEthBalance: await appEthBalance$().toPromise(),
        userLptBalance: await userLptBalance$().toPromise(),
        appsLptBalance: await appLptBalance$().toPromise(),
        appApprovedTokens: await appApprovedTokens$().toPromise(),
        currentRound: await currentRound$().toPromise(),
        delegatorInfo: {
            ...await delegatorInfo$().toPromise(),
            delegatorStatus: await delegatorStatus$().toPromise(),
            pendingFees: await delegatorPendingFees$().toPromise()
        },
        disableUnbondTokens: await disableUnbondTokens$().toPromise(),
        unbondingLockInfos: await unbondingLockInfos$().toPromise(),
        transcoder: {
            ...await transcoderDetails$().toPromise(),
            serviceUri: await transcoderServiceUri$().toPromise()
        }
    }
}

const onNewEvent = async (state, storeEvent) => {

    const {event, returnValues, address} = storeEvent

    switch (event) {
        case 'AppInitialized':
            console.log("APP INITIALIZED")
            livepeerAppAddress = address

            const initState = await initialState(state)

            return {
                ...initState,
                appAddress: livepeerAppAddress
            }
        case 'NewControllerSet':
            console.log("NEW CONTROLLER SET")
            return {
                ...state,
                livepeerControllerAddress: returnValues.livepeerController
            }
        case 'Transfer':
            console.log("LPT TRANSFER")
            const account = (await api.accounts().pipe(first()).toPromise())[0]

            if (account === returnValues.from || account === returnValues.to) {
                return {
                    ...state,
                    userLptBalance: await userLptBalance$().toPromise()
                }
            } else {
                return state
            }
        case 'VaultTransfer':
        case 'VaultDeposit':
            console.log("TRANSFER IN/OUT")
            return {
                ...state,
                appEthBalance: await appEthBalance$().toPromise(),
                userLptBalance: await userLptBalance$().toPromise(),
                appsLptBalance: await appLptBalance$().toPromise(),
            }
        case 'LivepeerAragonAppApproval':
            console.log("APPROVAL")
            return {
                ...state,
                appApprovedTokens: await appApprovedTokens$().toPromise()
            }
        case 'LivepeerAragonAppBond':
            console.log("BOND")
            return {
                ...state,
                appApprovedTokens: await appApprovedTokens$().toPromise(),
                appsLptBalance: await appLptBalance$().toPromise(),
                delegatorInfo: {
                    ...await delegatorInfo$().toPromise(),
                    delegatorStatus: await delegatorStatus$().toPromise(),
                    pendingFees: await delegatorPendingFees$().toPromise()
                },
                disableUnbondTokens: await disableUnbondTokens$().toPromise(),
                transcoder: {
                    ...state.transcoder,
                    totalStake: await transcoderStake$().toPromise()
                }
            }
        case 'LivepeerAragonAppUnbond':
            console.log("UNBOND")
            return {
                ...state,
                delegatorInfo: {
                    ...await delegatorInfo$().toPromise(),
                    delegatorStatus: await delegatorStatus$().toPromise(),
                    pendingFees: await delegatorPendingFees$().toPromise()
                },
                unbondingLockInfos: await unbondingLockInfos$().toPromise(),
                transcoder: {
                    ...state.transcoder,
                    ...await transcoderDetails$().toPromise()
                }
            }
        case 'LivepeerAragonAppRebond':
        case 'LivepeerAragonAppRebondFromUnbonded':
            console.log("REBOND")
            return {
                ...state,
                delegatorInfo: {
                    ...await delegatorInfo$().toPromise(),
                    delegatorStatus: await delegatorStatus$().toPromise(),
                    pendingFees: await delegatorPendingFees$().toPromise()
                },
                unbondingLockInfos: await unbondingLockInfos$().toPromise(),
                transcoder: {
                    ...state.transcoder,
                    ...await transcoderDetails$().toPromise()
                }
            }
        case 'LivepeerAragonAppEarnings':
            console.log("CLAIM EARNINGS")
            return {
                ...state,
                delegatorInfo: {
                    ...await delegatorInfo$().toPromise(),
                    pendingFees: await delegatorPendingFees$().toPromise()
                }
            }
        case 'LivepeerAragonAppFees':
            console.log('WITHDRAW FEES')
            return {
                ...state,
                appEthBalance: await appEthBalance$().toPromise(),
                delegatorInfo: {
                    ...await delegatorInfo$().toPromise(),
                    pendingFees: await delegatorPendingFees$().toPromise()
                }
            }
        case 'LivepeerAragonAppWithdrawStake':
            console.log("WITHDRAW STAKE")
            return {
                ...state,
                unbondingLockInfos: await unbondingLockInfos$().toPromise(),
                appsLptBalance: await appLptBalance$().toPromise()
            }
        case 'DistributeFees':
            console.log("DISTRIBUTE FEES")
            return {
                ...state,
                delegatorInfo: {
                    ...state.delegatorInfo,
                    pendingFees: await delegatorPendingFees$().toPromise()
                }
            }
        case 'LivepeerAragonAppDeclareTranscoder':
            console.log("DECLARE TRANSCODER")
            return {
                ...state,
                transcoder: {
                    ...state.transcoder,
                    ...await transcoderDetails$().toPromise()
                }
            }
        case 'LivepeerAragonAppReward':
            console.log("APP REWARD")
            return {
                ...state,
                delegatorInfo: await delegatorInfo$().toPromise(),
                transcoder: {
                    ...state.transcoder,
                    ...await transcoderDetails$().toPromise()
                }
            }
        case 'LivepeerAragonAppSetServiceUri':
            console.log("UPDATE SERVICE URI")
            return {
                ...state,
                transcoder: {
                    ...state.transcoder,
                    serviceUri: await transcoderServiceUri$().toPromise()
                }
            }
        case 'NewRound':
            console.log("NEW ROUND")
            return {
                ...state,
                currentRound: await currentRound$().toPromise(),
                unbondingLockInfos: await unbondingLockInfos$().toPromise(),
                disableUnbondTokens: await disableUnbondTokens$().toPromise(),
                transcoder: {
                    ...state.transcoder,
                    ...await transcoderDetails$().toPromise()
                }
            }
        case 'Reward':
            console.log("LIVEPEER REWARD")
            return {
                ...state,
                delegatorInfo: await delegatorInfo$().toPromise()
            }
        case ACCOUNT_CHANGED_EVENT:
            console.log("ACCOUNT CHANGED")
            return {
                ...state,
                userLptBalance: await userLptBalance$().toPromise()
            }
        default:
            return state
    }
}

const onNewEventCatchError = async (state, event) => {
    try {
        return await onNewEvent(state, event)
    } catch (error) {
        console.error(`Caught error: ${error}`)
    }
}

const accountChangedEvent$ = () =>
    api.accounts().pipe(
        map(account => {
            return {event: ACCOUNT_CHANGED_EVENT, account: account}
        }))

api.store(onNewEventCatchError,
    [
        accountChangedEvent$(),
        livepeerToken$(api).pipe(mergeMap(livepeerToken => livepeerToken.events())),
        bondingManager$(api).pipe(mergeMap(bondingManager => bondingManager.events())),
        roundsManager$(api).pipe(mergeMap(roundsManager => roundsManager.events())),
        jobsManager$(api).pipe(mergeMap(jobsManager => jobsManager.events()))
    ]
)

const errorReturnDefaultOperator = (whileFetching, defaultReturnValue) =>
    catchError(error => {
        console.error(`Error fetching ${whileFetching}: ${error}`)
        return of(defaultReturnValue)
    })

const appEthBalance$ = () =>
    livepeerAragonApp$(api, livepeerAppAddress).balance(ETHER_TOKEN_FAKE_ADDRESS).pipe(
        errorReturnDefaultOperator('appEthBalance', 0))

const userLptBalance$ = () =>
    api.accounts().pipe(
        first(),
        zip(livepeerToken$(api)),
        mergeMap(([accounts, token]) => token.balanceOf(accounts[0])),
        errorReturnDefaultOperator('userLptBalance', 0))

const appLptBalance$ = () =>
    livepeerToken$(api).pipe(
        mergeMap(token => token.balanceOf(livepeerAppAddress)),
        errorReturnDefaultOperator('appLptBalance', 0))

const appApprovedTokens$ = () =>
    livepeerToken$(api).pipe(
        zip(bondingManagerAddress$(api)),
        mergeMap(([token, bondingManagerAddress]) => token.allowance(livepeerAppAddress, bondingManagerAddress)),
        errorReturnDefaultOperator('appApprovedTokens', 0))

const currentRound$ = () =>
    roundsManager$(api).pipe(
        mergeMap(roundsManager => roundsManager.currentRound()),
        errorReturnDefaultOperator('currentRound', 0))

const pendingStakeFallback$ = (delegator) =>
    currentRound$().pipe(
        filter((currentRound) => currentRound <= delegator.lastClaimRound),
        mergeMap(() => of(0)))

const pendingStakeSuccess$ = (delegator) =>
    currentRound$().pipe(
        filter((currentRound) => currentRound > delegator.lastClaimRound),
        zip(bondingManager$(api)),
        mergeMap(([currentRound, bondingManager]) => bondingManager.pendingStake(livepeerAppAddress, currentRound)))

const pendingStake$ = (delegator) =>
    pendingStakeSuccess$(delegator).pipe(
        merge(pendingStakeFallback$(delegator)),
        errorReturnDefaultOperator('pendingStake', 0))

const delegatorInfo$ = () =>
    bondingManager$(api).pipe(
        mergeMap(bondingManager => bondingManager.getDelegator(livepeerAppAddress)),
        mergeMap(delegator => pendingStake$(delegator).pipe(
            map((pendingStake) => {
                return {
                    bondedAmount: delegator.bondedAmount,
                    fees: delegator.fees,
                    delegateAddress: delegator.delegateAddress,
                    lastClaimRound: delegator.lastClaimRound,
                    pendingStake: pendingStake
                }
            }))),
        errorReturnDefaultOperator('delegatorInfo', {
            bondedAmount: 0,
            fees: 0,
            delegateAddress: 0x00,
            lastClaimRound: 0,
            pendingStake: 0
        }))

const delegatorStatus$ = () =>
    bondingManager$(api).pipe(
        mergeMap(bondingManager => bondingManager.delegatorStatus(livepeerAppAddress)),
        errorReturnDefaultOperator('delegatorStatus', 0))

const delegatorPendingFees$ = () =>
    bondingManager$(api).pipe(
        zip(currentRound$()),
        mergeMap(([bondingManager, currentRound]) => bondingManager.pendingFees(livepeerAppAddress, currentRound)),
        catchError(error => of(0))) // Don't log error as pendingFees always reverts unless there are pending fees.

const mapBondingManagerToLockInfo = bondingManager =>
    bondingManager.getDelegator(livepeerAppAddress).pipe(
        zip(currentRound$()), // Zip here so we only get the current round once, if we did it after the range observable we would do it more times than necessary.
        mergeMap(([delegator, currentRound]) => range(0, delegator.nextUnbondingLockId).pipe(
            mergeMap(unbondingLockId => bondingManager.getDelegatorUnbondingLock(livepeerAppAddress, unbondingLockId).pipe(
                map(unbondingLockInfo => {
                    return {...unbondingLockInfo, id: unbondingLockId}
                }))),
            map(unbondingLockInfo => {
                return {
                    ...unbondingLockInfo,
                    disableWithdraw: parseInt(currentRound) < parseInt(unbondingLockInfo.withdrawRound)
                }
            }))))

const sortByLockId = (first, second) => first.id > second.id ? 1 : -1

const unbondingLockInfos$ = () =>
    bondingManager$(api).pipe(
        mergeMap(mapBondingManagerToLockInfo),
        filter(unbondingLockInfo => parseInt(unbondingLockInfo.amount) !== 0),
        toArray(),
        map(unbondingLockInfos => unbondingLockInfos.sort(sortByLockId)),
        errorReturnDefaultOperator('unbondingLockInfos', []))

const disableUnbondTokens$ = () =>
    bondingManager$(api).pipe(
        mergeMap(bondingManager => bondingManager.maxEarningsClaimsRounds()),
        zip(currentRound$(), delegatorInfo$()),
        map(([maxRounds, currentRound, delegatorInfo]) => delegatorInfo.lastClaimRound <= currentRound - maxRounds),
        errorReturnDefaultOperator('disableUnbondTokens', false))

const transcoderStake$ = () =>
    bondingManager$(api).pipe(
        mergeMap(bondingManager => bondingManager.transcoderTotalStake(livepeerAppAddress)),
        errorReturnDefaultOperator('transcoderStake', 0))

const transcoderStatus$ = () =>
    bondingManager$(api).pipe(
        mergeMap(bondingManager => bondingManager.transcoderStatus(livepeerAppAddress)),
        errorReturnDefaultOperator('transcoderStatus', 0))

const transcoderActive$ = () =>
    bondingManager$(api).pipe(
        zip(currentRound$()),
        mergeMap(([bondingManager, currentRound]) => bondingManager.isActiveTranscoder(livepeerAppAddress, currentRound)),
        errorReturnDefaultOperator('transcoderActive', false))

const transcoderServiceUri$ = () =>
    serviceRegistry$(api).pipe(
        mergeMap(serviceRegistry => serviceRegistry.getServiceURI(livepeerAppAddress)),
        errorReturnDefaultOperator('transcoderServiceUri', ''))

const transcoderDetails$ = () =>
    bondingManager$(api).pipe(
        mergeMap(bondingManager => bondingManager.getTranscoder(livepeerAppAddress)),
        zip(transcoderStake$(), transcoderStatus$(), transcoderActive$()),
        map(([transcoderDetails, totalStake, status, active]) => {
                return {
                    status: status,
                    active: active,
                    totalStake: totalStake,
                    lastRewardRound: transcoderDetails.lastRewardRound,
                    rewardCut: transcoderDetails.rewardCut,
                    feeShare: transcoderDetails.feeShare,
                    pricePerSegment: transcoderDetails.pricePerSegment,
                    pendingRewardCut: transcoderDetails.pendingRewardCut,
                    pendingFeeShare: transcoderDetails.pendingFeeShare,
                    pendingPricePerSegment: transcoderDetails.pendingPricePerSegment
                }
            },
            errorReturnDefaultOperator('transcoderDetails', {
                status: 0,
                active: false,
                totalStake: 0,
                lastRewardRound: 0,
                rewardCut: 0,
                feeShare: 0,
                pricePerSegment: 0,
                pendingRewardCut: 0,
                pendingFeeShare: 0,
                pendingPricePerSegment: 0
            }))
    )
