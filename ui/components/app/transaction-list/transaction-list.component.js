import React, { useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import {
  nonceSortedCompletedTransactionsSelector,
  nonceSortedPendingTransactionsSelector,
} from '../../../selectors/transactions';
import { getCurrentChainId } from '../../../selectors';
import { useI18nContext } from '../../../hooks/useI18nContext';
import TransactionListItem from '../transaction-list-item';
import SmartTransactionListItem from '../transaction-list-item/smart-transaction-list-item.component';
import Button from '../../ui/button';
import { TOKEN_CATEGORY_HASH } from '../../../helpers/constants/transactions';
import { SWAPS_CHAINID_CONTRACT_ADDRESS_MAP } from '../../../../shared/constants/swaps';
import { TransactionType } from '../../../../shared/constants/transaction';
import { isEqualCaseInsensitive } from '../../../../shared/modules/string-utils';
import { Box, Text } from '../../component-library';
import {
  TextColor,
  TextVariant,
} from '../../../helpers/constants/design-system';
import { formatDateWithYearContext } from '../../../helpers/utils/util';

const PAGE_INCREMENT = 10;

// When we are on a token page, we only want to show transactions that involve that token.
// In the case of token transfers or approvals, these will be transactions sent to the
// token contract. In the case of swaps, these will be transactions sent to the swaps contract
// and which have the token address in the transaction data.
//
// getTransactionGroupRecipientAddressFilter is used to determine whether a transaction matches
// either of those criteria
const getTransactionGroupRecipientAddressFilter = (
  recipientAddress,
  chainId,
) => {
  return ({ initialTransaction: { txParams } }) => {
    return (
      isEqualCaseInsensitive(txParams?.to, recipientAddress) ||
      (txParams?.to === SWAPS_CHAINID_CONTRACT_ADDRESS_MAP[chainId] &&
        txParams.data.match(recipientAddress.slice(2)))
    );
  };
};

const tokenTransactionFilter = ({
  initialTransaction: { type, destinationTokenSymbol, sourceTokenSymbol },
}) => {
  if (TOKEN_CATEGORY_HASH[type]) {
    return false;
  } else if (type === TransactionType.swap) {
    return destinationTokenSymbol === 'ETH' || sourceTokenSymbol === 'ETH';
  }
  return true;
};

const getFilteredTransactionGroups = (
  transactionGroups,
  hideTokenTransactions,
  tokenAddress,
  chainId,
) => {
  if (hideTokenTransactions) {
    return transactionGroups.filter(tokenTransactionFilter);
  } else if (tokenAddress) {
    return transactionGroups.filter(
      getTransactionGroupRecipientAddressFilter(tokenAddress, chainId),
    );
  }
  return transactionGroups;
};

const groupTransactionsByDate = (transactionGroups) => {
  const groupedTransactions = [];

  transactionGroups.forEach((transactionGroup) => {
    const date = formatDateWithYearContext(
      transactionGroup.primaryTransaction.time,
      'MMM d, y',
      'MMM d',
    );

    const existingGroup = groupedTransactions.find(
      (group) => group.date === date,
    );

    if (existingGroup) {
      existingGroup.transactionGroups.push(transactionGroup);
    } else {
      groupedTransactions.push({
        date,
        dateMillis: transactionGroup.primaryTransaction.time,
        transactionGroups: [transactionGroup],
      });
    }
    groupedTransactions.sort((a, b) => b.dateMillis - a.dateMillis);
  });

  return groupedTransactions;
};

export default function TransactionList({
  hideTokenTransactions,
  tokenAddress,
}) {
  const [limit, setLimit] = useState(PAGE_INCREMENT);
  const t = useI18nContext();

  const unfilteredPendingTransactions = useSelector(
    nonceSortedPendingTransactionsSelector,
  );
  const unfilteredCompletedTransactions = useSelector(
    nonceSortedCompletedTransactionsSelector,
  );
  const chainId = useSelector(getCurrentChainId);
  const renderDateStamp = (index, dateGroup) => {
    return index === 0 ? (
      <Text
        paddingTop={4}
        paddingInline={4}
        variant={TextVariant.bodyMd}
        color={TextColor.textDefault}
        key={dateGroup.dateMillis}
      >
        {dateGroup.date}
      </Text>
    ) : null;
  };

  const pendingTransactions = useMemo(
    () =>
      groupTransactionsByDate(
        getFilteredTransactionGroups(
          unfilteredPendingTransactions,
          hideTokenTransactions,
          tokenAddress,
          chainId,
        ),
      ),
    [
      hideTokenTransactions,
      tokenAddress,
      unfilteredPendingTransactions,
      chainId,
    ],
  );

  const completedTransactions = useMemo(
    () =>
      groupTransactionsByDate(
        getFilteredTransactionGroups(
          unfilteredCompletedTransactions,
          hideTokenTransactions,
          tokenAddress,
          chainId,
        ),
      ),
    [
      hideTokenTransactions,
      tokenAddress,
      unfilteredCompletedTransactions,
      chainId,
    ],
  );

  const viewMore = useCallback(
    () => setLimit((prev) => prev + PAGE_INCREMENT),
    [],
  );

  return (
    <Box className="transaction-list" paddingTop={4}>
      <Box className="transaction-list__transactions">
        {pendingTransactions.length > 0 && (
          <Box className="transaction-list__pending-transactions">
            {pendingTransactions.map((dateGroup) => {
              return dateGroup.transactionGroups.map(
                (transactionGroup, index) => {
                  ///: BEGIN:ONLY_INCLUDE_IN(build-main,build-beta,build-flask)
                  if (
                    transactionGroup.initialTransaction.transactionType ===
                    TransactionType.smart
                  ) {
                    return (
                      <>
                        {renderDateStamp(index, dateGroup)}
                        <SmartTransactionListItem
                          isEarliestNonce={index === 0}
                          smartTransaction={transactionGroup.initialTransaction}
                          transactionGroup={transactionGroup}
                          key={`${transactionGroup.nonce}:${index}`}
                        />
                      </>
                    );
                  }
                  ///: END:ONLY_INCLUDE_IN
                  return (
                    <>
                      {renderDateStamp(index, dateGroup)}
                      <TransactionListItem
                        isEarliestNonce={index === 0}
                        transactionGroup={transactionGroup}
                        key={`${transactionGroup.nonce}:${index}`}
                      />
                    </>
                  );
                },
              );
            })}
          </Box>
        )}
        <Box className="transaction-list__completed-transactions">
          {completedTransactions.length > 0 ? (
            completedTransactions.slice(0, limit).map((dateGroup) => {
              return dateGroup.transactionGroups.map(
                (transactionGroup, index) => {
                  return (
                    <>
                      {renderDateStamp(index, dateGroup)}
                      {transactionGroup.initialTransaction?.transactionType ===
                      'smart' ? (
                        <SmartTransactionListItem
                          transactionGroup={transactionGroup}
                          smartTransaction={transactionGroup.initialTransaction}
                          key={`${transactionGroup.nonce}:${index}`}
                        />
                      ) : (
                        <TransactionListItem
                          transactionGroup={transactionGroup}
                          key={`${transactionGroup.nonce}:${
                            limit + index - 10
                          }`}
                        />
                      )}
                    </>
                  );
                },
              );
            })
          ) : (
            <Box className="transaction-list__empty">
              <Box className="transaction-list__empty-text">
                {t('noTransactions')}
              </Box>
            </Box>
          )}
          {completedTransactions.length > limit && (
            <Button
              className="transaction-list__view-more"
              type="secondary"
              onClick={viewMore}
            >
              {t('viewMore')}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}

TransactionList.propTypes = {
  hideTokenTransactions: PropTypes.bool,
  tokenAddress: PropTypes.string,
};

TransactionList.defaultProps = {
  hideTokenTransactions: false,
  tokenAddress: undefined,
};
